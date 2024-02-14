function Instagram_report() {

    var now = new Date();
    
    var SSId = "";//instagram数値記録用のスプレッドシートのID
  
    //instagrmaGraphAPI 必要情報
    var instagramID = "";
    var username = "";//instagramアカウントのユーザー名
    var access_token = "";//アクセストークン
    var mySS = SpreadsheetApp.openById(SSId);//IDでスプレッドシートを開く
    var profile_sheet = mySS.getSheetByName("profile_data");//差分の基本データを入力したいシートの名前
    var feed_sheet = mySS.getSheetByName("feed_data");//差分のフィード投稿データを入力したいシートの名前
    var reel_sheet = mySS.getSheetByName("reel_data");//差分のリール投稿データを入力したいシートの名前
    var story_sheet = mySS.getSheetByName("story_data");//差分のストーリーデータを入力したいシートの名前
    var db_feed_sheet = mySS.getSheetByName("feed_db");//フィード投稿データのdbにしたいシートの名前
    var db_reel_sheet = mySS.getSheetByName("reel_db");//リール投稿データのdbにしたいシートの名前
    var db_profile_sheet = mySS.getSheetByName("profile_db");//基本データのdbにしたいシートの名前
  

    var media_data_array = get_Instagram_data(now,profile_sheet, instagramID, username, access_token,db_profile_sheet);
  
    get_media_data(feed_sheet,reel_sheet,story_sheet,db_feed_sheet,db_reel_sheet,media_data_array,access_token,now);
  
    console.log("終了");
  
  }
  
  
  //インスタグラムのフォロワーと投稿数のデータを取得してシートに書き込む関数
  function get_Instagram_data(date, sheet, instagramID, username, access_token,db_profile_sheet) {
  
    //日付フォーマットの整形
    var now = Utilities.formatDate(date, 'JST', 'yyyy/MM/dd(E)HH:mm');
  
      var url = 'https://graph.facebook.com/v18.0/' + instagramID + '?fields=business_discovery.username(' + username + '){followers_count,follows_count,media_count,media{comments_count,like_count,id,media_product_type,media_type,media_url,timestamp,thumbnail_url}}&access_token=' + access_token;
      var encodedURI = encodeURI(url);
      var response = UrlFetchApp.fetch(encodedURI);
  
  
    var jsonData = JSON.parse(response);
  
    //console.log(jsonData.business_discovery.media)
    var follower = jsonData.business_discovery.followers_count
    var media_count = jsonData.business_discovery.media_count
    var media_array = jsonData.business_discovery.media.data
  
    console.log("メディア数"+media_count)
  
    var data = [[now,follower,media_count]];
    
    //差分計算して書き込み
    cda_judge_sheet_write(sheet,db_profile_sheet,data);
  
    var array = [];
    //メディアIDを新しい配列に入れてループで渡す
    for(let i = 0; i < media_array.length; i++){
      array.push(media_array[i]);
    }
  
    //次のページがあったら追加でarrayにデータをいれる（100個まで）
    var after_media_access_token = jsonData.business_discovery.media.paging.cursors.after;
    var page_num = 1;//100件までの制限をかける
  
    while(after_media_access_token){
  
      var after_url = 'https://graph.facebook.com/v18.0/' + instagramID + '?fields=business_discovery.username(' + username + '){followers_count,follows_count,media_count,media.after(' + after_media_access_token + '){comments_count,like_count,id,media_product_type,media_url,timestamp,thumbnail_url}}&access_token=' + access_token;
      var encodedURI = encodeURI(after_url);
      var response = UrlFetchApp.fetch(encodedURI);
  
      var jsonData = JSON.parse(response);
      var media_array = jsonData.business_discovery.media.data
      //console.log(media_array)
      for(let i = 0; i < media_array.length; i++){
        array.push(media_array[i]);
      }
  
      page_num++;
  
      //console.log(page_num++)
      if(page_num==2){
        break;
      }
    };
  
    console.log("データ数"+array.length)
    //メディアデータが入った配列を渡す
    return array
  }
  
  //インスタグラムの投稿のデータを取得する関数
  function get_media_data(feed_sheet,reel_sheet,story_sheet,db_feed_sheet,db_reel_sheet,media_data_array,access_token,now){
  
    var feed_array = [];
    var reel_array = [];
    var story_array = [];
  
  
    for (let i = 0; i < media_data_array.length;i++){
  
      var post_id = media_data_array[i].id
      var metric = product_type_judge(media_data_array[i].media_product_type)
      
      
      var url = 'https://graph.facebook.com/v18.0/' + post_id + '/insights?metric=' + metric + '&access_token=' + access_token;
      var encodedURI = encodeURI(url);
      var response = UrlFetchApp.fetch(encodedURI);
      var jsonData = JSON.parse(response);
  
      //console.log('サムネイルは？'+jsonData )
      media_data_array[i].data = jsonData.data
    
      //media_puroduct_typeごと入れる配列を分ける
      if(media_data_array[i].media_product_type == "REELS"){
        
        reel_array.push(clean_media_data(media_data_array[i],now));
  
      }else if(media_data_array[i].media_product_type == "FEED"){
        
        feed_array.push(clean_media_data(media_data_array[i],now));
  
      }else if(media_data_array[i].media_product_type == "STORY"){
  
        story_array.push(clean_media_data(media_data_array[i],now));
  
      }else{
        ;
      }
      
    }
  
    //最終計算
    cda_judge_sheet_write(feed_sheet,db_feed_sheet,feed_array);
    cda_judge_sheet_write(reel_sheet,db_reel_sheet,reel_array);
  
  }
  
  //メディアプロダクトタイプを判別してそれにあったパラメータを返してクエリを投げる
  function product_type_judge(media_product_type){
  
    var metric;
  
    if(media_product_type=="REELS"){
  
      metric = "comments,likes,plays,reach,saved,shares"
    
    }else if(media_product_type=="FEED"){
  
      metric = "impressions,reach,saved,video_views"
  
    }else if(media_product_type=="STORY"){
  
      metric = "impressions,reach,replies"
  
    }else{
      ;
    }
    return metric
  }
  
  //media_data_arrayをオブジェクトから配列にする関数
  function clean_media_data(media_data,now){
    //console.log(media_data)
    var clean_array = [];
  
    //media_dataの共通部分を配列に入れる
    clean_array.push(media_data.comments_count);
    clean_array.push(media_data.like_count);
    clean_array.push(media_data.id);
    clean_array.push(media_data.media_product_type);
  
    var new_date = new Date(media_data.timestamp);
    var timestamp = Utilities.formatDate(new_date, 'JST', 'yyyy/MM/dd(E)HH:mm');
    console.log(timestamp);
  
    clean_array.push(timestamp);
    
    //img_urlのpush。media_typeがvideoじゃないとthumbnail_url取得できないため
    if(media_data.thumbnail_url){
      clean_array.push(media_data.thumbnail_url);
    }else{
      clean_array.push(media_data.media_url);
    }
  
    //各メディアプロダクトタイプに合わせたインサイトをとりだす
    for(let i = 0; i < media_data.data.length;i++){
      //console.log('%o',media_data.data[i].values[0])//objectの中身をみれる
  
      clean_array.push(media_data.data[i].values[0].value);
    //test
   
    }
    //データ書き込み時間  
    var write_now = Utilities.formatDate(now, 'JST', 'yyyy/MM/dd(E)HH:mm');
    clean_array.push(write_now);
    return clean_array;
  }
  
  //スプレッドシートと二次元配列を受け取ってシートに書き込む関数
  function sheet_write(sheet,data_array){
  
    var lastRow = sheet.getRange(sheet.getMaxRows(), 1).getNextDataCell(SpreadsheetApp.Direction.UP).getRowIndex();
    var lastColumn = sheet.getRange(1, sheet.getMaxColumns()).getNextDataCell(SpreadsheetApp.Direction.PREVIOUS).getColumn();
  
    //今はストーリーは空配列なのでエラーがでてしまうためエラーをキャッチする。
    try{
      sheet.insertRowsAfter(lastRow,data_array.length);
      var addrange = sheet.getRange(lastRow+1,1,data_array.length,lastColumn);
      addrange.setValues(data_array);
    }catch(e){
      console.log(e);
    }
  
  }
  
  //二次元配列を受け取ってデータベースシートを上書きする関数
  function db_sheet_write(db_sheet,db_array){
  
    //db_arrayは毎回全部のデータが入るはずなので2,1で大丈夫
    try{
    
      var addrange = db_sheet.getRange(2,1,db_array.length,db_array[0].length);
      addrange.setValues(db_array);
    }catch(e){
      console.log(e);
    }
  
  }
  
  //シートからデータを取ってくる関数
  function get_sheet_db(sheet){
  
    var lastRow = sheet.getRange(sheet.getMaxRows(), 1).getNextDataCell(SpreadsheetApp.Direction.UP).getRowIndex();
    var lastColumn = sheet.getRange(1, sheet.getMaxColumns()).getNextDataCell(SpreadsheetApp.Direction.PREVIOUS).getColumn();
  
    try{
        var addrange = sheet.getRange(2,1,lastRow-1,lastColumn);
        var db_array = addrange.getValues();
  
        return db_array;
  
      }catch(e){
        console.log('get_sheet_db' + e);
        return 0;
      }
  
  }
  
  //データベースが空かどうか判断してシートに書き込む関数
  function cda_judge_sheet_write(sheet,db_sheet,data_array){
  
    var db_array = get_sheet_db(db_sheet);
    var sheet_name = sheet.getSheetName();
    console.log('func cda_judge_sheet_write -> ' + db_array)
    console.log(sheet_name);
    if(db_array == 0){
      //データベースが何もなければ両方に書き込む,一番最初の実行
      db_sheet_write(db_sheet,data_array);
      sheet_write(sheet,data_array)
    
    }else{
      /*
      db_array = [
        [comments_count,like_count,id,media_product_type,timestamp,img_url,comments,likes,plays,reach,saved,shares,last_updated_time]
      ]
      */
  
      if(sheet_name.match('profile')){
        //profiledataの差分を書き込む関数
        console.log('profileの差分を書き込みたい');
        profile_data_culc_sheet_write(data_array,db_array,sheet,db_sheet);
  
      }else{
        array_culc_sheet_write(data_array,db_array,sheet,db_sheet);
      };
      
      
    };
  
  };
  
  //data_arrayのidがdb_arrayにあればdb_arrayの値を書き換え、なければdb_arrayに追加
  function array_culc_sheet_write(data_array, db_array,sheet,db_sheet) {
    var diff_reel_array = [];//db_arrayとdata_arrayの差分を入れる場所
    var diff_feed_array = [];
    //var new_data_array = [];
  
    var array_judge = data_array[0][3];
    console.log('array_judge:'+array_judge)
    //idがあるか判定
    for (let i = 0; i < data_array.length; i++) {
      var id_index = existsInArrayB(data_array[i][2], db_array);
      console.log("インデックス" + id_index);
  
      if (typeof id_index === 'number' && !isNaN(id_index)) {
        //idがあった場合
  
        //差分をdiff_arrayに
        if(array_judge=="REELS"){
          var diff_array = [
            data_array[i][0] - db_array[id_index][0],
            data_array[i][1] - db_array[id_index][1],
            db_array[id_index][2],
            db_array[id_index][3],
            db_array[id_index][4],
            db_array[id_index][5],
            data_array[i][6] - db_array[id_index][6],
            data_array[i][7] - db_array[id_index][7],
            data_array[i][8] - db_array[id_index][8],
            data_array[i][9] - db_array[id_index][9],
            data_array[i][10] - db_array[id_index][10],
            data_array[i][11] - db_array[id_index][11],
            data_array[i][12]
          ];
  
          diff_reel_array.push(diff_array);
  
  
        }else if(array_judge=="FEED"){
          var diff_array = [
            data_array[i][0] - db_array[id_index][0],
            data_array[i][1] - db_array[id_index][1],
            db_array[id_index][2],
            db_array[id_index][3],
            db_array[id_index][4],
            db_array[id_index][5],
            data_array[i][6] - db_array[id_index][6],
            data_array[i][7] - db_array[id_index][7],
            data_array[i][8] - db_array[id_index][8],
            data_array[i][9] - db_array[id_index][9],
            data_array[i][10]
          ];
  
          diff_feed_array.push(diff_array);
  
        }
        
        db_array[id_index] = Array.from(data_array[i]);
  
      } else {
        //idがない→diff_arrayとdb_arrayに追加
        console.log('初めてのデータ:'+ data_array[i] );
        if(array_judge=="REELS"){
          diff_reel_array.push(Array.from(data_array[i]));
        }else if(array_judge=="FEED"){
          diff_feed_array.push(Array.from(data_array[i]));
        };
        
        db_array.push(Array.from(data_array[i]));
      }
      
    }
  
  
    //差分を書き込む
    if(array_judge=="REELS"){
      sheet_write(sheet,diff_reel_array);
  
    }else if(array_judge=="FEED"){
      sheet_write(sheet,diff_feed_array);
  
    }
    //dbを新しくする
  
    db_sheet_write(db_sheet,db_array);
  }
  
  //user_insightでの差分とdb_arrayの値を書き換えをする関数
  function profile_data_culc_sheet_write(data_array,db_array,sheet,db_sheet){
    console.log('profile_sheetに書いてるよ');
    var diff_profile_array = [
      data_array[0][0],//now
      data_array[0][1]-db_array[0][1],//follower
      data_array[0][2]-db_array[0][2]//media_count
    ];
    try{
      db_sheet.getRange(2,1,1,data_array[0].length).setValues(data_array);
    sheet.appendRow(diff_profile_array);
    }catch(e){
      console.log('get_sheet_db' + e);
    };
    
    
  };
  
  //ある値が配列に存在するか判定
  function existsInArrayB(id, db_array) {
    for (let i = 0; i < db_array.length; i++) {
      
      if (db_array[i][2] == id) {
  
        return i;
      }
      
    }
    return false;
  }