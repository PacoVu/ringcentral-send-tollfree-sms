var canPoll = false
function init(){
  var jsonObj = JSON.parse(window.sendReport)
  /*
  if (jsonObj.sendInProgress){
    $("#progress").toggleClass("show")
    //$("#control_panel").css('display', 'block');
    //disableInputs(true)
    //pollResult()
  }
  */
}

function pollResult(){
  var url = "getresult"
  var getting = $.get( url );
  canPoll = true
  getting.done(function( res ) {
    if (res.sendInProgress == true) {
      window.setTimeout(function(){
        if (canPoll)
          pollResult()
      }, 1000)
    }else{
      disableInputs(false)
    }
    $("#time").html(res.sentInfo)
    $("#success").html(res.successCount)
    $("#failure").html(res.failedCount)
  });
}

function disableInputs(flag){

  $("#from-number").prop("disabled", flag);
  $("#to-numbers").prop("disabled", flag);
  $("#message").prop("disabled", flag);
  $("#attachment").prop("disabled", flag);
  $("#send-message").prop("disabled", flag);

  if (flag){
    //$("#get-input").hide()
    $("#send-message").toggleClass("btn")
    $("#sendingAni").css('display', 'inline');
    $("#download_json").toggleClass("hide")
    $("#download_csv").toggleClass("hide")
    download_csv
  }else{
    //$("#get-input").show()
    $("#send-message").toggleClass("btn-rc")
    $("#sendingAni").css('display', 'none');
    $("#download_json").toggleClass("show")
    $("#download_csv").toggleClass("show")
    $("#control_panel").css('display', 'none');
  }
}

function setDelayInterVal(){
  var url = "setdelay"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      alert(res.message)
    else
      alert(res.message)
  });
}

function pause_resume(){
  var title = $("#pause_resume").text()
  if (title == "Pause"){
    $("#pause_resume").text("Resume")
    $("#sendingAni").css('display', 'none');
    pauseMessageSending()
  }else{
    $("#pause_resume").text("Pause")
    resumeMessageSending()
  }
}

function pauseMessageSending(){
  var url = "pause"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      canPoll = false
      //alert(res.message)
    else
      alert(res.message)
  });
}

function resumeMessageSending(){
  var url = "resume"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      $("#sendingAni").css('display', 'inline');
      pollResult()
    }else
      alert(res.message)
  });
}
function confirmCancel(){
  var r = confirm("Do you really want to cancel sending message?");
  if (r == true) {
    cancelMessageSending()
  }
}
function cancelMessageSending(){
  var url = "cancel"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      canPoll = false
      disableInputs(false)
      //alert(res.message)
    }else
      alert(res.message)
  });
}

function downloadReport(format){
  var url = "downloadreport?format="+format
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

var group = 1
var currentGroup = 0
function addRecipientGroup(){
  group++
  var groupIndex = $("#group_index").val() + "_" + group
  $("#group_index").val(groupIndex)
  var newGroup = '<div id="g_'+ group + '" class="group_block"><img class="corner" src="./img/close.png" onclick="removeMe(\'g_' + group + '\',' + group + ')"></img><div><label class="label-input">To numbers</label><textarea rows="6" cols="16" id="to-numbers_' + group + '" name="recipients_' + group + '" placeholder="+11234567890&#10;+14087654322&#10;+16501234567" class="form-control text-input" required></textarea>&nbsp;<input type="file" style="display: inline; width: 200px" onchange="fileSelected(this, ' + group + ');"></input></div><label class="label-input" for="message">Message</label><textarea rows="4" cols="50" name="message_' + group + '" class="form-control text-input" required></textarea></div>'
  $("#groups").append(newGroup);

  var page = '<span id="tab_'+group+'"><a href="javascript:showGroup('+group+')">' + (group - 1) + '</a>&nbsp;&nbsp;</span>'
  $("#groups_tab").append(page);

  // hide old group
  if (group > 2){
    var g = "#g_"+ (group-1).toString()
    $(g).hide()
  }
  // show new group
  $("#g_"+group).show()
  currentGroup = group
}

function showGroup(groupNum){
  // hide current group
  $("#g_"+currentGroup).hide()
  var g = "#g_"+ groupNum
  $(g).show()
  currentGroup = groupNum
}

function removeMe(block, index){
  $("#"+block).remove()
  var indexes = $("#group_index").val().split("_")
  var groupIndex = indexes.filter(function(e) { return e !== index.toString() })
  var indexesString = groupIndex.join("_")
  $("#group_index").val(indexesString)

  // remove group tab
  $("#tab_"+currentGroup).remove()
  // show last group from group tab
  $("#groups").children().first().show()
  currentGroup = $("#groups").children().first().attr("id").split("_")[1]
}
