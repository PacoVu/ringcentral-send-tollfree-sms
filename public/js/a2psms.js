var currentBatchId = ""
var pendingBatch = false
var isPolling = false
function init(){
  var jsonObj = JSON.parse(window.batchResult)
  if (jsonObj.status == "Processing" && jsonObj.id != ""){
    pendingBatch = true
    currentBatchId = jsonObj.id
    isPolling = false // force to start polling
    switchPollResult()
    pollResult()
  }

  else{
    $("#control_block").hide()
  }

}

var pollTimer = null
function switchPollResult(){
  $("#result_block").show()
  if (isPolling){
    if (pollTimer)
      window.clearTimeout(pollTimer)
    pollTimer = null
    isPolling = false
    $("#sendingAni").css('display', 'none');
    $("#polling_tips").css('display', 'none');
    $("#read_result").text("Start Polling")
  }else{
    $("#sendingAni").css('display', 'inline');
    $("#polling_tips").css('display', 'inline');
    $("#read_result").text("Stop Polling")
    isPolling = true
    pollResult()
  }
}

function pollResult(){
  if (currentBatchId == "")
    return
  var url = "getbatchresult?batchId=" + currentBatchId
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      //alert(res.result)
      parseResultResponse(res)
    }else {
      alert(res.result)
    }
  });
}

function showResult(flag){
  if (flag){
    //$("#send-message").toggleClass("btn")
    $("#result_block").show()
    $("#sendingAni").css('display', 'inline');
  }else{
    //$("#send-message").toggleClass("btn-rc")
    $("#result_block").hide()
    $("#sendingAni").css('display', 'none');
  }
}


function downloadReport(){
  var url = "downloadreport?format="
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

function openWindow(){
  window.open("https://github.com/PacoVu/ringcentral-send-tollfree-sms/issues")
}
function openFeedbackForm(){
  var message = $('#send_feedback_form');
  BootstrapDialog.show({
      title: '<div style="font-size:1.2em;font-weight:bold;">Send us your feedback!</div><div>Do you have a suggestion or found some bugs? Let us know in the field below:</div>',
      message: message,
      draggable: true,
      onhide : function(dialog) {
        $('#hidden-div-feedback').append(message);
      },
      buttons: [{
        label: 'Close',
        action: function(dialog) {
          dialog.close();
        }
      }, {
        label: 'Send Feedback',
        cssClass: 'btn btn-primary',

        action: function(dialog) {
          var params = {
            user_name: window.userName,
            emotion: $('input[name=emoji]:checked').val(),
            type: $("#feedback_type").val(),
            message: $("#free_text").val()
          }
          if (submitFeedback(params))
            dialog.close();
        }
      }]
  });
  return false;
}

function submitFeedback(params){
  var url = "sendfeedback"
  var posting = $.post( url, params );
  posting.done(function( res ) {
    if (res.status == "ok"){
      alert(res.message)
    }else
      alert(res.message)
  });
  return true
}

// Not used. Upload file directly to backend
function fileSelected(elm, index){
  var file = elm.files[0]
  if (file) {
    var reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function(e) {
      var numbers = e.target.result.trim().split("\r\n")
      numbers.shift()
      $("#to-numbers_" + index).val(numbers.join("\r\n"));
    };
  }
}

function countCharacter(elm, index){
    var text = $(elm).val()
    $("#charcount_"+index).html("SMS length: " + text.length + " chars.")
}

var group = 0
var currentGroup = 0
var groups = []
// use to upload file directly.
function addCustomizedMessage(e){
  e.preventDefault()
  // should check if message and numbers are entered
  if (group > 0){
    if (checkToRecipientsInputs(group) == false){
      return alert("Please enter recipients number or select from a .csv file!")
    }
    if (checkMessageInputs(group) == false){
      return alert("Please enter text message!")
    }
  }
  group++
  var item = {
    groupNumber: group,
    groupName: ""
  }
  groups.push(item)

  var groupIndex = ($("#group_index").val() == "") ? group : $("#group_index").val() + "_" + group
  $("#group_index").val(groupIndex)

  var newGroup = '<div id="g_'+ group + '" class="group_block"><img class="corner" src="./img/close.png" onclick="removeMe(\'g_' + group + '\',' + group + ')"></img>'
  newGroup += '<label class="label-input">To numbers</label>'
  newGroup += '<textarea rows="4" cols="14" id="recipients_'+group+'" name="recipients_'+group+'" placeholder="+11234567890&#10;+14087654322&#10;+16501234567" class="form-control text-input"></textarea>'
  newGroup += '&nbsp;&nbsp;&nbsp;'
  newGroup += '<label class="label-column">Or, load from .csv file (single column with header row)</br>'
  newGroup += '<input type="file" id="attachment_'+group+'" name="attachment_'+group+'"></input>'
  newGroup += '</label>'
  newGroup += '<div><label class="label-input">Message</br><div class="char-count" id="charcount_'+group+'">Char length: 0 char.</div></label>'
  newGroup += '<textarea rows="3" cols="60" id="message_'+group+'" name="message_'+group+'" oninput="countCharacter(this, '+group+')" class="form-control text-input"></textarea>&nbsp;&nbsp;'
  newGroup += '</div></div>'
  $("#groups").append(newGroup);

  for (var i=0; i < groups.length; i++){
    var name = i+1
    groups[i].groupName = "Customized Message - " + name.toString()
  }
/*
  $("#groups_tab").empty()
  for (var g of groups){
    var page = '<div id="tab_'+g.groupNumber+'" class="tab_item"><a href="javascript:showGroup('+g.groupNumber+')">' + (g.groupName ) + '</a>&nbsp;&nbsp;</div>'
    $("#groups_tab").append(page);
  }
*/
  $("#groups_list").empty()
  for (var g of groups){
    $("#groups_list").append(($('<option>', {
        value: g.groupNumber,
        text : g.groupName
    })));
  }
  // hide old group
  var len = $('#groups_list > option').length;
  if (len > 1){
    var g = "#g_"+ (group-1).toString()
    $(g).hide()
    $("#groups_list").show()
    $('#groups_list').val(group);
  }else{
    $("#groups_list").hide()
  }
  // show new group
  $("#g_"+group).show()
  currentGroup = group
  $("#recipients_"+group).focus()
}
/*
function showGroup(groupNum){
  // hide current group
  $("#g_"+currentGroup).hide()
  var g = "#g_"+ groupNum
  $(g).show()
  currentGroup = groupNum
}
*/
function showGroup(){
  // hide current group
  $("#g_"+currentGroup).hide()
  var groupNum = $("#groups_list").val()
  var g = "#g_"+ groupNum
  $(g).show()
  currentGroup =  $("#groups_list option:selected").val()
}

function removeMe(block, index){
  $("#"+block).remove()
  var indexes = $("#group_index").val().split("_")
  var groupIndex = indexes.filter(function(e) { return e !== index.toString() })
  var indexesString = groupIndex.join("_")
  $("#group_index").val(indexesString)

  // remove group from groups
  groups.splice(groups.findIndex(item => item.groupNumber === index), 1)
  for (var i=0; i < groups.length; i++){
    var name = i+1
    groups[i].groupName = name.toString()
  }
/*
  $("#groups_tab").empty()
  for (var g of groups){
    var page = '<span id="tab_'+g.groupNumber+'"><a href="javascript:showGroup('+g.groupNumber+')">' + (g.groupName ) + '</a>&nbsp;&nbsp;</span>'
    $("#groups_tab").append(page);
  }
*/

  $("#groups_list").empty()
  for (var g of groups){
    $("#groups_list").append(($('<option>', {
        value: g.groupNumber,
        text : "Customized Message - " + g.groupName
    })));
  }
  // keep group index
  //$("#groups_list option:selected").remove()

  var len = $('#groups_list > option').length;
  if (len == 0){
    $("#groups_list").hide()
  }if (len == 1){
    $("#groups_list").hide()
    $("#groups_list").val($("#groups_list option:first").val());
    currentGroup = $("#groups_list").val()
  }else{
    //$('#groups_list').val(1);
    $("#groups_list").val($("#groups_list option:first").val());
    currentGroup = $("#groups_list").val()
  }
  // show first group from group tab
  $("#groups").children().first().show()
  //currentGroup = $("#groups").children().first().attr("id").split("_")[1]
}

// submit form using ajax seems not enforce required inputs
function checkMessageInputs(g){
  if ($("#message_" + g).val() == ""){
    $("#message_" + g).focus()
    return false
  }
  return true
}
function checkToRecipientsInputs(g){
  if ($("#recipients_" + g).val() == "" && $("#attachment_" + g).val() == ""){
    $("#recipients_" + g).focus()
    return false
  }
  return true
}
function checkFromField(){
  if ($("#from_number").val() == null){
    $("#from_number").focus()
    return false
  }
  return true
}

function sendBatchMessage(e) {
  e.preventDefault();
  if (pendingBatch){
    var r = confirm("You have a pending batch. Do you want to send a new batch before the previous batch completed?");
    if (r == true) {
      // cancel polling
      if (isPolling)
        switchPollResult()
      pendingBatch = false
      canSendMessages()
    }
  }else{
    canSendMessages()
  }
}

function canSendMessages() {
  $("#result_block").hide()
  if (checkFromField() == false){
    return alert("Please select a Toll-Free number.")
  }
  if (group == 0){ // check minimum the main text and recipient number are set
    if (checkToRecipientsInputs(0) == false){
      return alert("Please enter recipients number or select from a .csv file!")
    }
    if (checkMessageInputs(0) == false){
      return alert("Please enter text message!")
    }
  }
  var form = $("#sms-form");
  var formData = new FormData(form[0]);
  $.ajax({
      url: "/sendhighvolumemessage",
      type: 'POST',
      data: formData,
      success: function (res) {
          if (res.status == "ok"){
            pendingBatch = true
            isPolling = false // force to start polling
            switchPollResult()
            parseResultResponse(res)
          }
      },
      cache: false,
      contentType: false,
      processData: false
  });
}

function parseResultResponse(resp){
  currentBatchId = resp.result.id
  $("#control_block").show()
  $("#status").html("Status: " + resp.result.status)

  if (resp.result.status == "Processing"){
    pendingBatch = true
    // show the time since batch request was submited
    $("#time").html("Duration: " + resp.time)
    var text = "Sending " + resp.result.processedCount + " out of " + resp.result.batchSize + " messages."
    $("#result").html(text)
    pollTimer = window.setTimeout(function(){
      isPolling = true
      pollResult()
    }, 5000)
  }else if (resp.result.status == "Completed"){
    pendingBatch = false
    // calculate and show the time logged by the system
    var createdAt = new Date(resp.result.createdAt).getTime()
    var lastUpdatedAt = new Date(resp.result.lastUpdatedAt).getTime()
    var processingTime = (lastUpdatedAt - createdAt) / 1000
    $("#time").html("Duration : " + formatSendingTime(processingTime))
    var text = "Sent " + resp.result.processedCount + " out of " + resp.result.batchSize + " messages."
    $("#result").html(text)
    isPolling = true // force to stop polling!
    switchPollResult()
    readReport()
  }
}

function formatSendingTime(processingTime){
  var hour = Math.floor(processingTime / 3600)
  hour = (hour < 10) ? "0"+hour : hour
  var mins = Math.floor((processingTime % 3600) / 60)
  mins = (mins < 10) ? "0"+mins : mins
  var secs = Math.floor(((processingTime % 3600) % 60))
  secs = (secs < 10) ? "0"+secs : secs
  return `${hour}:${mins}:${secs}`
}

function readReport(){
  if (currentBatchId == "")
    return
  $("#report_block").show()
  $("#report").html("Reading report ...")
  var url = "getbatchreport?batchId=" + currentBatchId
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      var report = "<div>"
        for (var key of Object.keys(res.result)){
          report += "<div>" + key + " = " + res.result[key] + "</div>"
        }
      report += "</div>"
      $("#report").html(report)
    }else{
      alert("Error: " + res.result)
    }
  });
}
