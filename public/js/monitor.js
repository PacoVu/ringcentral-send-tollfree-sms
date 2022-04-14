var timeOffset = 0
var pollingTimer = undefined
var users = []
var activeUsers = []
/*
var topPos = 170;
var leftPos;
var dlgWidth = 0
var dlgHeight = 0
*/
function init(){
  google.charts.load('current', {'packages':['corechart'], callback: onloaded});
  window.onresize = function() {
    setElementsHeight()
  }
  setElementsHeight()
  /*
  $(`#${mainMenuItem}`).removeClass("active")
  mainMenuItem = "analytics"
  $(`#${mainMenuItem}`).addClass("active")
  */

  activeUsers = window.activeUsers
  displayActiveUsers()
  createFullReport(window.allUsers)
  pollingTimer = window.setTimeout(function(){
      pollActiveUsers()
  },10000)
}

function onloaded(){

}

function setElementsHeight(){
  var height = $(window).height() - $("#footer").outerHeight(true)
  var width = $(window).width();
  /*
  dlgWidth = width * 0.85;
  dlgHeight = height * 0.7
  leftPos = (width - dlgWidth)/2
  */
  var swindow = height - $("#menu_header").height()
  $("#message-col").height(swindow)
  $("#menu-pane").height(swindow)
  $("#users-list").height(swindow - 280)
}

function pollActiveUsers(){
  var url = "poll-active-users"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      //console.log(res.activeUsers)
      activeUsers = JSON.parse(res.activeUsers)
      //console.log(activeUsers)
      displayActiveUsers()
      pollingTimer = window.setTimeout(function(){
          pollActiveUsers()
      },5000)
    }else{
      $("#processing").hide()
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
}

function displayActiveUserActivity(){
  var id = $("#active-users").val()
  var user = window.allUsers.find(o => o.userId == id)
  /*
  var item = {
    id: user.extensionId,
    accountId: user.accountId,
    email: user.userEmail,
    name: user.userName,
    activities: user.userActivities
  }
  */
  var au = window.activeUsers.find(o => o.id == id)
  if (user)
    //loadUserActivities_Monitor(id, user.totalCost.toFixed(2), user.reputationScore)
    loadUserActivities_Monitor(user, au.activities)
}


function displayActiveUsers(){
  var total = 0
  var campaigns = 0
  var conversations = 0
  var logs = 0
  var settings = 0
  var analytics = 0
  var tf_sms = 0
  var help = 0

  $('#active-users option').remove();
  for (var user of activeUsers){
    if (user.id == '0')
      continue
    total++
    $('#active-users').append($('<option>', {
      value: user.id,
      text: `${user.name} - ${user.id}`
    }));
    if (user.hasOwnProperty('activities')){
      switch (user.activities.currentPresence) {
        case 'campaigns':
          campaigns++
          break
        case 'conversations':
          conversations++
          break
        case 'logs':
          logs++
          break
        case 'settings':
          settings++
          break
        case 'analytics':
          analytics++
          break
        case 'help':
          help++
          break
        case 'standard-sms':
          tf_sms++
          break
        default:
          break
      }
    }
  }
  $('#online-count').html(`Total: ${total}`)
  $("#active-users").selectpicker('refresh');
  $('#campaigns-count').html(`Campaigns: ${campaigns}`)
  $('#conversations-count').html(`Conversations: ${conversations}`)
  $('#logs-count').html(`Logs: ${logs}`)
  $('#tf-sms-count').html(`TF SMS: ${tf_sms}`)
  $('#analytics-count').html(`Analytics: ${analytics}`)
  $('#settings-count').html(`Settings: ${settings}`)
  $('#help-count').html(`Help: ${help}`)
}
/*
function loadUserActivities(elm){
    var id = $(elm).val()
    var user = window.usersActivities.find(o => o.user_id == id)
    if (user){
      var batches = JSON.parse(user.batches)
      var totalCount = 0
      var deliveredCount = 0
      var unreachableCount = 0
      var rejectedCount = 0
      for (b of batches){
        //alert(b.campaignName)
        totalCount += b.totalCount
        deliveredCount += b.deliveredCount
        unreachableCount += b.unreachableCount
        rejectedCount = b.rejectedCount
      }

      var params = [[ 'Status', '# messages', { role: "style" } ]];

      var item = [ "Total", totalCount, '#178006' ]
      params.push(item)
      item = [ "Delivered", deliveredCount, '#1126ba']
      params.push(item)

      item = [ "Failed", unreachableCount, '#03918f' ]
      params.push(item)

      item = [ "Rejected", rejectedCount, '#0770a8' ]
      params.push(item)

      drawColumnChart(params, "user-messages-stats", '# Messages by status', "# Messages")

    }
}
*/
//function loadUserActivities_Monitor(id, totalCost, reputationScore){
function loadUserActivities_Monitor(user, activities){
  var id = user.userId
  var totalCost = user.totalCost.toFixed(2)
  var reputationScore  = user.reputationScore
  console.log(reputationScore)
  var accountId = user.accountId

  var user = window.usersActivities.find(o => o.user_id == id)

  if (user){
    var html = "<div>"
    var userName = (user.full_name) ? user.full_name : "N/A"
    html += `<div><label>User name:</label> ${userName} &nbsp; - &nbsp; <span><a target='_blank' href='https://admin.ringcentral.com/userinfo/csaccount.asp?user=XPDBID++++++++++${accountId}User'>Open company</a></span>`
    //html += "<div>Email: " + user.email + "</div>"
    var subject = ""
    var body = ""
    html += " - <label>Email:</label><span> <a href=mailto:" + user.email + ">" + user.email + "</a></span></div>"
    //var activities = JSON.parse(user.activities)

    var totalMessages = (activities.standard_sms.total_messages) ? activities.standard_sms.total_messages : 0
    totalMessages += (activities.campaign_broadcast.total_messages) ? activities.campaign_broadcast.total_messages : 0
    totalMessages += (activities.campaign_personalized.total_messages) ? activities.campaign_personalized.total_messages : 0
    totalMessages += (activities.campaign_survey.total_messages) ? activities.campaign_survey.total_messages : 0
    html += `<div><span style="min-width:180px"><label>Account Id:</label> ${accountId}</span>`
    html += `<span style="min-width:140px;margin-left:100px"> <label>Extension Id:</label> ${id}</div>`

    html += `<div><span style="min-width:140px"><label>Total Messages:</label> ${totalMessages}</span>`
    html += `<span style="min-width:140px;margin-left:100px"><label>Total Cost:</label> ${totalCost}</span>`
    if (activities.currentPresence){
      var presence = capitalizeFirstLetter(activities.currentPresence)
      html += `<span style="min-width:140px;margin-left:100px"><label>Current Presense:</label> ${presence}</span>`
    }else
      html += `<span style="min-width:140px;margin-left:100px"><label>Current Presense:</label> Offline</span>`

    html += `<div><label>Reputation:</label>`
    if (isNaN(reputationScore)){
      for (var number of reputationScore){
        html += `<div style="margin-left:50px">Number: ${formatPhoneNumber(number.number)} => Score: ${number.score}</div>`
      }
    }else{
      html += `<div style="margin-left:50px">Number: Not yet updated! => Score: ${reputationScore}</div>`
    }
    html += `</div>`

    $("#summary").html(html)
    //
    var params = [[ 'Type', '# messages', { role: "style" } ]];

    var item = [ "Bro", activities.campaign_broadcast.total_messages, '#1126ba']
    params.push(item)

    item = [ "Per", activities.campaign_personalized.total_messages, '#03918f' ]
    params.push(item)

    item = [ "Sur", activities.campaign_survey.total_messages, '#0770a8' ]
    params.push(item)

    item = [ "TF", activities.standard_sms.total_messages, '#1770a8' ]
    params.push(item)

    item = [ "Convo", activities.conversations.total_messages, '#F770a8' ]
    params.push(item)

    drawColumnChart(params, "message-type", '# Messages by campaign type', "# Messages")

    params = [[ 'Status', '# Messages', { role: "style" } ]];

    item = [ "Delivered", activities.campaigns_logs.total_delivered, '#1126ba']
    params.push(item)

    item = [ "Failed", activities.campaigns_logs.total_failed, '#03918f' ]
    params.push(item)

    item = [ "Rejected", activities.campaigns_logs.total_rejected, '#F770a8' ]
    params.push(item)

    drawColumnChart(params, "message-status", '# Campaign messages by status', "# Messages")

    params = [[ 'Type', '# campaigns', { role: "style" } ]];

    //var item = [ "Total", totalMessages, '#178006' ]
    //params.push(item)
    item = [ "Bro", activities.campaign_broadcast.count, '#1126ba']
    params.push(item)

    item = [ "Per", activities.campaign_personalized.count, '#03918f' ]
    params.push(item)

    item = [ "Sur", activities.campaign_survey.count, '#0770a8' ]
    params.push(item)

    item = [ "TF", activities.standard_sms.count, '#1770a8' ]
    params.push(item)

    drawColumnChart(params, "campaign-type", '# Campaigns by type', "# Campaigns")

    params = [[ 'Data', '# Download Report', { role: "style" } ]];

    item = [ "Cam.", activities.campaigns_logs.download_count, '#1126ba']
    params.push(item)

    item = [ "Msg S", activities.message_store_downloads.count, '#03918f' ]
    params.push(item)

    item = [ "Ana.", activities.analytics.download_count, '#0770a8' ]
    params.push(item)

    item = [ "Survey", activities.campaign_survey.download_count, '#1770a8' ]
    params.push(item)

    drawColumnChart(params, "page-access", '# Report downloads by type', "# Downloads")
    //
    html = ''
    var lastSeenDateStr = "N/A"
    var timeOffset = new Date().getTimezoneOffset()*60000;
    var date = undefined
    if (activities.standard_sms.ts > 0){
      date = new Date(activities.standard_sms.ts)
      var timestamp = date.getTime() - timeOffset
      var lastSeenDate = new Date (timestamp)
      lastSeenDateStr = lastSeenDate.toISOString()
      lastSeenDateStr = lastSeenDateStr.replace("T", " ").substring(0, 16)
    }
    html += `<div><label>Standard TF SMS:</label> ${lastSeenDateStr}</div>`
    // Downloads: ${activities.standard_sms.download_count}
    lastSeenDateStr = "N/A"
    if (activities.campaign_broadcast.ts > 0){
      date = new Date(activities.campaign_broadcast.ts)
      timestamp = date.getTime() - timeOffset
      lastSeenDate = new Date (timestamp)
      lastSeenDateStr = lastSeenDate.toISOString()
      lastSeenDateStr = lastSeenDateStr.replace("T", " ").substring(0, 16)
    }
    html += `<div><label>HV Broadcast:</label> ${lastSeenDateStr}</div>`
    //  Downloads: ${activities.campaign_broadcast.download_count}
    html += "</div>"
    $("#left").html(html)

    lastSeenDateStr = "N/A"
    if (activities.campaign_personalized.ts > 0){
      date = new Date(activities.campaign_personalized.ts)
      timestamp = date.getTime() - timeOffset
      lastSeenDate = new Date (timestamp)
      lastSeenDateStr = lastSeenDate.toISOString()
      lastSeenDateStr = lastSeenDateStr.replace("T", " ").substring(0, 16)
    }
    html = `<div><label>HV Customized:</label> ${lastSeenDateStr}</div>`
    // Downloads: ${activities.campaign_personalized.download_count}
    lastSeenDateStr = "N/A"
    if (activities.campaign_survey.ts > 0){
      date = new Date(activities.campaign_survey.ts)
      timestamp = date.getTime() - timeOffset
      lastSeenDate = new Date (timestamp)
      lastSeenDateStr = lastSeenDate.toISOString()
      lastSeenDateStr = lastSeenDateStr.replace("T", " ").substring(0, 16)
    }
    html += `<div><label>HV Survey:</label> ${lastSeenDateStr}</div>`
    // Downloads: ${activities.campaign_survey.download_count}
    //html += "</div>"

    $("#right").html(html)
  }

  var message = $('#user_dialog');
  BootstrapDialog.show({
      title: '<div style="font-size:1.2em;font-weight:bold;">User info and activities</div>',
      message: message,
      draggable: true,
      onhide : function(dialog) {
        $('#hidden-div-user-info').append(message);
      },
      buttons: [{
        label: 'Close',
        cssClass: 'rc-oval-btn',
        action: function(dialog) {
          dialog.close();
        }
      },
      {
        label: 'Block',
        cssClass: 'rc-oval-btn btn-left',
        action: function(dialog) {
          setReputation(user.user_id, 0, reputationScore)
          dialog.close()
        }
      },
      {
        label: 'Restore Reputation',
        cssClass: 'rc-oval-btn btn-left',
        action: function(dialog) {
          setReputation(user.user_id, 1000, reputationScore)
          dialog.close()
        }
      },
      {
        label: 'Message snapshots',
        cssClass: 'rc-oval-btn btn-left',
        action: function(dialog) {
          getMessageSnapshots(user.user_id)
          //dialog.close()
        }
      }]
  });
  return false;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function setReputation(userId, score, numberReputation){
  var url = `set_reputation`
  for (var number of numberReputation)
    number.score = score
  var params = {
    //score: score,
    numberReputation: JSON.stringify(numberReputation),
    user_id: userId
  }
  var posting = $.post( url, params );
  posting.done(function( res ) {
    if (res.status == "ok"){
      console.log(res.result)
    }else if (res.status == "failed") {
      alert(res.message)
      window.location.href = "login"
    }else{
      alert(res.message)
    }
  });
}

function getMessageSnapshots(userId){
  var url = `get_message_snapshots`
  var params = {
    user_id: userId
  }
  var posting = $.post( url, params );
  posting.done(function( res ) {
    if (res.status == "ok"){
      //console.log(res.result)
      var html = ''
      for (var cpg of res.result){
        html += `<div><span style="color:blue">${cpg.count}</span> => ${cpg.message}</div>`
      }
      $("#message-snapshot-list").html(html)
      $("#message-snapshot-list").show()
    }else {
      alert(res.messages)
    }
  });
}

function displayUserActivities(params){
    //writeTitle('statistics-title', 'Cost by direction (per month)')
    var colors = ['#178006','#f04b3b','#1126ba', '#AA26ba']
    drawComboChart(params, "user-messages-stats", 'Messages', 'User name', 'Status', colors)
}


function createFullReport(fullReports){
  var i = 0
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var tabledata = []
  for (var user of fullReports){
    i++
    var date = new Date(user.lastSeen)
    var timestamp = date.getTime() - timeOffset
    var lastSeenDate = new Date (timestamp)
    var lastSeenDateStr = lastSeenDate.toISOString()
    lastSeenDateStr = lastSeenDateStr.replace("T", " ").substring(0, 16)
    var score = 1000
    if (isNaN(user.reputationScore)){
      for (var number of user.reputationScore){
        console.log(number)
        if (number.score < score)
          score = number.score
      }
    }else{
      score = user.reputationScore
    }
    var item = {
      "Index": i,
      //"Name": user.accountId,
      "UserId": user.userId,
      //"Batches": `${user.groupBatches} | ${user.customizedBatches} | ${user.voteBatches} | ${user.tollfreeBatches}`,
      //"Messages": `${user.groupMessages} | ${user.customizedMessages} | ${user.voteMessages} | ${user.tollfreeMessages}`,
      "Messages": user.totalSentMessage,
      "Cost": user.totalCost.toFixed(2),
      "Reputation" : score,
      "LastSeen": lastSeenDateStr
    }
    tabledata.push(item)
  }
  var table = new Tabulator("#users-list", {
    data:tabledata, //assign data to table
    //autoColumns:true, //create columns from data field names
    layout:"fitColumns",      //fit columns to width of table
    responsiveLayout:"hide",  //hide columns that dont fit on the table
    tooltips:true,            //show tool tips on cells
    addRowPos:"top",          //when adding a new row, add it to the top of the table
    history:true,             //allow undo and redo actions on the table
    //pagination:"local",       //paginate the data
    //paginationSize:7,         //allow 7 rows per page of data
    movableColumns:false,      //allow column order to be changed
    resizableRows:true,       //allow row order to be changed
    initialSort:[             //set the initial sort order of the data
        {column:"LastSeen", dir:"asc"},
    ],
    columns:[                 //define the table columns
        {title:"#", field:"Index", width:14},
        //{title:"Account Id", field:"AccountId", width:130, sorter:"number"},
        {title:"User Id", field:"UserId", width:100, editor:false, sorter:"number"},
        //{title:"Batches G | C | V | TF", field:"Batches", hozAlign:"center", width:190, editor:false, sorter:"number"},
        //{title:"Messages G | C | V | TF", field:"Messages", hozAlign:"center", width:190, editor:false},
        {title:"Total Sent", field:"Messages", width:110,  hozAlign:"center"},
        {title:"Total Cost", field:"Cost", width:110,  hozAlign:"center"},
        {title:"Reputation", field:"Reputation", width:100, sorter:"number"},
        {title:"Last Campaign", field:"LastSeen", width:180, sorter:"date", hozAlign:"center", editor:false},
    ],
    rowClick:function(e, row){
      //e - the click event object
      //row - row component
      //console.log(row.getData().UserId)
      //var user = window.usersActivities.find(o => o.user_id === row.getData().UserId)
      //loadUserActivities_Monitor(row.getData().UserId, row.getData().Cost, row.getData().Reputation)
      var user = window.allUsers.find(o => o.userId == row.getData().UserId)
      var ua = window.usersActivities.find(o => o.user_id == row.getData().UserId)
      var activities = JSON.parse(ua.activities)
      if (user){
        $("#message-snapshot-list").html("")
        $("#message-snapshot-list").hide()
        loadUserActivities_Monitor(user, activities, null)
      }
    }
  });

}

function drawComboChart(params, graph, title, vTitle, hTitle, colors){
  var data = google.visualization.arrayToDataTable(params);
  var view = new google.visualization.DataView(data);
  var columns = [];
  for (var i = 0; i <= colors.length; i++) {
      if (i > 0) {
          columns.push(i);
          columns.push({
              calc: "stringify",
              sourceColumn: i,
              type: "string",
              role: "annotation"
          });

      } else {
          columns.push(i);
      }
  }
  view.setColumns(columns);
  var options = {
          //title : title,
          width: "98%",
          height: 210,
          //vAxis: {minValue: 0, title: `${vTitle}`},{vAxis: {format:'#%'}
          //hAxis: {title: `${hTitle}`, format: 0},
          vAxis: { minValue: 0, title: `${vTitle}` },
          hAxis: {minValue: 0, format: 0},
          seriesType: 'bars',
          bar: {groupWidth: "60%"},
          legend: { position: "top" },
          colors: colors //['#2280c9','#2f95a5', '#f04b3b']
          //series: {3: {type: 'line'}}
        };

  var chart = new google.visualization.ComboChart(document.getElementById(graph));
  chart.draw(view, options);
}

function formatFloatNumber(number){
  if (number >= 100.0)
    return number.toFixed(0)
  else if (number >= 10)
    return number.toFixed(1)
  else
    return number.toFixed(2)
}

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
function convertMonth(month){
  var year_month = month.split("-")
  var monthStr = months[parseInt(year_month[1])-1]
  monthStr += ` ${year_month[0].substring(2, 4)}`
  return monthStr
}


function drawColumnChart(params, graph, title, vTitle){
    var data = google.visualization.arrayToDataTable(params);
    var view = new google.visualization.DataView(data);
    view.setColumns([0, 1,
                    { calc: "stringify",
                       sourceColumn: 1,
                       type: "string",
                       role: "annotation"
                    },
                    2]);

    var options = {
      title: title,
      vAxis: {minValue: 0, title: `${vTitle}`},
      //hAxis: {format: 0},
      width: 320,
      height: 210,
      bar: {groupWidth: "80%"},
      legend: { position: "none" },
    };

    var chart = new google.visualization.ColumnChart(document.getElementById(graph));
    chart.draw(view, options);
}

function drawPieChart(params, graph, title, colors, slice){
  var data = google.visualization.arrayToDataTable(params);
  //var view = new google.visualization.DataView(data);
  var slices = {}
  slices[slice] = {offset: 0.4}

  var options = {
    title: title,
    width: 300,
    height: 300,
    colors: colors,
    backgroundColor: 'transparent',
    chartArea:{left:0,top:20,bottom:0,width:'100%',height:'100%'},
    legend: {
      position: "right",
      maxLines: 2,
      textStyle: {
        fontSize: 10

      }
    },
    pieSliceText: 'value',
    //pieStartAngle: 90,
    //pieHole: 0.5,
    sliceVisibilityThreshold: 0.0001,
    slices: slices
  };

  var element = document.getElementById(graph)
  var chart = new google.visualization.PieChart(element);
  chart.draw(data, options);
}

function drawScatterChart(params, graph, title, vTitle, hTitle) {
    var data = google.visualization.arrayToDataTable(params);
    var options = {
      title: title,
      width: "100%",
      height: 220,
      vAxis: {title: `${vTitle}`, minValue: 0},
      hAxis: {title: `${hTitle}`, minValue: 0, maxValue: 23, format: 0},
      viewWindow: {minValue: 0, maxValue: 23},
      pointShape: { type: 'triangle', rotation: 180 },
      colors:['#2280c9','#2f95a5', '#f04b3b'],
      legend: {
        position: "right"
      }
    };

    var element = document.getElementById(graph)
    var chart = new google.visualization.LineChart(element);
    chart.draw(data, options);
}


function downloadAnalytics(){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var fileName = `${$("#fromdatepicker").val()}-${$("#todatepicker").val()}`
  var url = `download-analytics?timeOffset=${timeOffset}&fileName=${fileName}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      window.location.href = res.message
    else
      alert(res.message)
  });
}

function logout(){
  window.location.href = "index?n=1"
}
