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

function openReplyForm(toNumber, fromNumber){
  var message = $('#send_reply_form');
  $('#send_reply_form').on('shown.bs.modal', function () {

    setTimeout(function (){
      $("#text-message").focus()
    }, 1000);
  })
  BootstrapDialog.show({
      title: `<div style="font-size:1.2em;font-weight:bold;">Reply to: ${formatPhoneNumber(toNumber)}</div>`,
      message: message,
      draggable: true,
      onhide : function(dialog) {
        $('#hidden-div-reply').append(message);
      },
      buttons: [{
        label: 'Cancel',
        action: function(dialog) {
          dialog.close();
        }
      }, {
        label: 'Send',
        cssClass: 'btn btn-primary',

        action: function(dialog) {
          var params = {
            from: fromNumber,
            to: toNumber,
            message: $("#text-message").val()
          }
          if (params.message == ""){
            $("#text-message").focus()
            return alert("Please enter text message!")
          }
          var url = "sendindividualmessage"
          var posting = $.post( url, params );
          posting.done(function( res ) {
            if (res.status == "ok"){
              window.setTimeout(function(){
                readMessageStore(pageToken)
              },2000)
              dialog.close();
            }else if (res.status == "failed"){
              alert(res.message)
              dialog.close();
              //window.location.href = "login"
            }else{
              alert(res.message)
              dialog.close();
            }
          });
          posting.fail(function(response){
            alert(response.statusText);
            dialog.close();
          });
        }
      }]
  });
  return false;
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
