function openReplyForm(toNumber, fromNumber){
  var message = $('#send_reply_form');
  setTimeout(function (){
    $("#text-message").focus()
  }, 1000);
  $('#send_reply_form').on('shown.bs.modal', function () {
    ;
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
            return _alert("Please enter text message!")
          }
          var url = "sendindividualmessage"
          var posting = $.post( url, params );
          posting.done(function( res ) {
            if (res.status == "ok"){
              /*
              window.setTimeout(function(){
                readMessageStore(pageToken)
              },2000)
              */
              dialog.close();
            }else if (res.status == "failed"){
              _alert(res.message)
              dialog.close();
              //window.location.href = "login"
            }else{
              alert(res.message)
              dialog.close();
            }
          });
          posting.fail(function(response){
            _alert(response.statusText);
            dialog.close();
          });
        }
      }]
  });
  return false;
}

function addToRecipient(elm){
  $("#to-new-number").val($(elm).val())
}

function openSendNewText(){
  $("#contacts-block").show()
  if (contactList.length > 0){
    if ($("#contact-list").val() == ""){
      var contacts = ""
      for (var contact of contactList){
        var name = `${contact.fname} ${contact.lname}`
        //var optionText = name;
        //var optionValue = contact.phoneNumber;
        //$('#contact-list').append(`<option value="${optionValue}"> ${optionText} </option>`);
        contacts += `<option value="${contact.phoneNumber}">${name}</option>`
      }
    }
    $("#contact-list").html(contacts)
    $('#contact-list').selectpicker('refresh');
  }

  var fromNumber = $("#my-numbers").val()

  var message = $('#send_new_form');
  setTimeout(function (){
    $("#to-new-number").focus()
  }, 1000);
  $('#send_new_form').on('shown.bs.modal', function () {
    ;
  })
  BootstrapDialog.show({
      title: `<div style="font-size:1.2em;font-weight:bold;">Send new text from ${formatPhoneNumber(fromNumber)}</div>`,
      message: message,
      draggable: true,
      onhide : function(dialog) {
        $('#hidden-div-new-conversation').append(message);
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
            to: $("#to-new-number").val(),
            message: $("#new-text-message").val()
          }

          if (params.to == ""){
            $("#to-new-number").focus()
            return _alert("Please enter a recipient phone number!")
          }
          if (params.message == ""){
            $("#new-text-message").focus()
            return _alert("Please enter text message!")
          }
          var url = "sendindividualmessage"
          var posting = $.post( url, params );
          posting.done(function( res ) {
            if (res.status == "ok"){
              dialog.close();
            }else if (res.status == "failed"){
              _alert(res.message)
              dialog.close();
              //window.location.href = "login"
            }else{
              _alert(res.message)
              dialog.close();
            }
          });
          posting.fail(function(response){
            _alert(response.statusText);
            dialog.close();
          });
        }
      }]
  });
  return false;
}
