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
  /*
  var formatedNumber = ""
  var numberStr = number.toString()
  for (var i=0; i<numberStr.length; i++){
    formatedNumber += numberStr[i]
    if (i%3 == 0)
      formatedNumber += ","
  }
  return formatedNumber
  */
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
