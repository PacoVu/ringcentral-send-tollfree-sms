var mainMenuItem = "campaign-new"
function downloadReport(format){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var url = "downloadbatchreport?format=" + format + "&timeOffset=" + timeOffset
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

function formatSendingTime(processingTime){
  var hour = Math.floor(processingTime / 3600)
  hour = (hour < 10) ? "0"+hour : hour
  var mins = Math.floor((processingTime % 3600) / 60)
  mins = (mins < 10) ? "0"+mins : mins
  var secs = Math.floor(((processingTime % 3600) % 60))
  secs = (secs < 10) ? "0"+secs : secs
  return `${hour}:${mins}:${secs}`
}

function formatPhoneNumber(phoneNumberString, countryCode) {
  var cleaned = ('' + phoneNumberString).replace(/\D/g, '')
  var match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
  if (match) {
    var intlCode = (match[1] ? '+1 ' : '')
    if (countryCode)
      return [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
    else
      return ['(', match[2], ') ', match[3], '-', match[4]].join('')
  }
  return phoneNumberString
}

function formatNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

var errorCodes = {
  "SMS-UP-410": "Destination number invalid, unallocated, or does not support this kind of messaging.",
  "SMS-UP-430": "Spam content detected by SMS gateway.",
  "SMS-UP-431": "Number blacklisted due to spam.",
  "SMS-UP-500": "General SMS gateway error. Upstream is malfunctioning.",
  "SMS-CAR-104": "Carrier has not reported delivery status.",
  "SMS-CAR-199": "Carrier reports unknown message status.",
  "SMS-CAR-400": "Carrier does not support this kind of messaging.",
  "SMS-CAR-411": "Destination number invalid, unallocated, or does not support this kind of messaging.",
  "SMS-CAR-412": "Destination subscriber unavailable.",
  "SMS-CAR-413": "Destination subscriber opted out.",
  "SMS-CAR-430": "Spam content detected by mobile carrier.",
  "SMS-CAR-431": "Message rejected by carrier with no specific reason.",
  "SMS-CAR-432": "Message is too long.",
  "SMS-CAR-433": "Message is malformed for the carrier.",
  "SMS-CAR-450": "P2P messaging volume violation.",
  "SMS-CAR-460": "Destination rejected short code messaging.",
  "SMS-CAR-500": "Carrier reported general service failure.",
  "SMS-RC-410": "Destination number unsupported. Or missing a country code.",
  "SMS-RC-413": "Destination subscriber opted out.",
  "SMS-RC-500": "Please report this error to us.",
  "SMS-RC-501": "Please report this error to us.",
  "SMS-RC-503": "Please report this error to us.",
  "SMS-NO-ERROR": "Sent successfullly."
}

function getErrorDescription(errorCode){
  for (var key of Object.keys(errorCodes)){
    if (key == errorCode)
      return errorCodes[key]
  }
  return ""
}

function openWindow(){
  window.open("https://github.com/PacoVu/ringcentral-send-tollfree-sms/issues")
}
function openFeedbackForm(preFilledText){
  var message = $('#send_feedback_form');
  $("#free_text").html('')
  if (preFilledText != undefined){
    $("#free_text").html(preFilledText)
  }
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
    alert(res.message)
  });
  return true
}

function _alert(msg, title, focusField){
  if(navigator.userAgent.indexOf("Firefox") != -1 ) {
    if (focusField)
      $(focusField).focus()
    //$('#hidden-div-error').model({show: true});
    return alert(msg);
  }
  if (title == undefined)
    title = "Error"
  BootstrapDialog.show({
      title: `<div style="font-size:1.2em;font-weight:bold;color:white">${title}</div>`,
      message: msg,
      draggable: true,
      onhide : function(dialog) {
        $('#hidden-div-error').append(msg);
      },
      buttons: [{
        label: 'Close',
        action: function(dialog) {
          dialog.close();
          if (focusField)
            $(focusField).focus()
        }
      }]
  });
  return false;
}
