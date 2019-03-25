function init(){
  if (report.sendInProgress){
    $("#progress").toggleClass("show")
    //$("#sms-form").prop("disabled", false);
    //$("#send-message").prop("disabled", true);
    //$("#logginIcon").css('display', 'inline');
    disableInputs(true)
    pollResult()
  }
}
function pollResult(){
  var url = "getresult"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.sendInProgress == true) {
      window.setTimeout(function(){
        pollResult()
      }, 1000)
    }else{
      disableInputs(false)
      //$("#sms-form").prop("disabled", false);
      //$("#send-message").prop("disabled", false);
      //$("#logginIcon").css('display', 'none');
    }
    $("#success").html(res.successCount)
    $("#failure").html(res.failedCount)
    if (res.failedCount.length > 0) {
      var htmlStr = ""
      for (var item of res['invalidNumbers']) {
        htmlStr += "<div>" + item.reason + ": " + item.number + "</div>"
      }
      $('#invalid-numbers').html(htmlStr)
    }
  });
}

function disableInputs(flag){
  $("#from-number").prop("disabled", flag);
  $("#to-numbers").prop("disabled", flag);
  $("#message").prop("disabled", flag);
  $("#attachment").prop("disabled", flag);
  $("#send-message").prop("disabled", flag);
  if (flag)
    $("#logginIcon").css('display', 'inline');
  else
    $("#logginIcon").css('display', 'none');
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
