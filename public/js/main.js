var canPoll = false
function init(){
  if (report.sendInProgress){
    $("#progress").toggleClass("show")
    //$("#control_panel").toggleClass("show")
    $("#control_panel").css('display', 'block');

    disableInputs(true)
    pollResult()
  }
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
    /*
    if (res.failedCount.length > 0) {
      var htmlStr = ""
      for (var item of res['invalidNumbers']) {
        htmlStr += "<div>" + item.reason + ": " + item.number + "</div>"
      }
      $('#invalid-numbers').html(htmlStr)
    }
    */
  });
}

function disableInputs(flag){
  $("#from-number").prop("disabled", flag);
  $("#to-numbers").prop("disabled", flag);
  $("#message").prop("disabled", flag);
  $("#attachment").prop("disabled", flag);
  $("#send-message").prop("disabled", flag);
  if (flag){
    $("#sendingAni").css('display', 'inline');
    $("#download_json").toggleClass("hide")
    $("#download_csv").toggleClass("hide")
    download_csv
  }else{
    $("#sendingAni").css('display', 'none');
    $("#download_json").toggleClass("show")
    $("#download_csv").toggleClass("show")
    //$("#control_panel").toggleClass("hide")
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

function postMessage(){
    $("#sms-form").ajaxSubmit({
        dataType: 'json',
        success: function(data, statusText, xhr, wrapper){
            //$('#display-image').prop("src","/assets/images/tmp/"+data);
            //update relevent product form fields here
            alert(data)
        }
    });
    /*
  var data = new FormData(jQuery('#sms-form')[0]);
   jQuery.ajax({
     type: "post",
     contentType: false,
     processData: false,
     url: jQuery(this).attr('action'),
     dataType: "json",
     data: data,
     success: function (r) {
      // Success Handeling
      alert("r")
     }
    });
    */
}
function sendMessage(){
  $("#send-message").prop("disabled", true);
  $("#logginIcon").css('display', 'inline');
  var configs = {}
  configs['fromNumber'] = $("#from-number").val()
  configs['recipients'] = $("#to-numbers").val()
  configs['message'] = $('#message').val();
  var url = "sendsms"
  var posting = $.post( url, configs );
  posting.done(function( response ) {
    var res = JSON.parse(response)
    $("#send-message").prop("disabled", false);
    $("#logginIcon").css('display', 'none');
    if (res.status != "ok") {
      alert(res.message)
    }else{
      alert(res.message)
    }
  });
  posting.fail(function(response){
    $("#send-message").prop("disabled", false);
    $("#logginIcon").css('display', 'none');
    alert("Error. Please try again.");
  });
}

function openFeedbackForm(){
  var message = $('#send_feedback_form');
  BootstrapDialog.show({
      title: 'Send us your feedback!',
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
            message: $("#free_text").val()
          }
          if (submitFeedback(params))
            dialog.close();
        }
      }]
  });
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
