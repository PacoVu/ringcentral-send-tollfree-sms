var contactList = []
var optedOutNumbers = []
var selectedContactGroup = ""
var webhook = undefined
function init(){
  window.onresize = function() {
    setElementsHeight()
  }
  setElementsHeight()

  $(`#${mainMenuItem}`).removeClass("active")
  mainMenuItem = "settings"
  $(`#${mainMenuItem}`).addClass("active")

  readContacts()
}

function setElementsHeight(){
  var height = $(window).height() - $("#footer").outerHeight(true)
  var swindow = height - $("#menu_header").height()
  $("#menu-pane").height(swindow)
  $("#control-col").height(swindow)
  $("#contact-list").height(swindow - 200)
  $("#opted-out-list").height(swindow - $("#optout-block-header").outerHeight(true) - 20)
  $("#code").height(swindow - $("#webhook-inputs").outerHeight(true) - 20)
}

var prevView = "contacts-block"
function showView(view){
  if (prevView != ""){
    $(`#${prevView}`).hide()
    $(`#${prevView}-btn`).removeClass("active");
  }
  $(`#${view}`).show()
  $(`#${view}-btn`).addClass("active");
  prevView = view

  if (view == "contacts-block"){
    $("#webhook").hide()
    $("#optout-block").hide()
  }else if (view == "webhook-block") {
    $("#optout-block").hide()
    $("#contacts-block").hide()
    if ($("#webhook-address").val() == "")
      return readWebhookAddress(view)
  }else if (view == "contact-block") {
    $("#webhook-block").hide()
    $("#optout-block").hide()
  }else if (view == "optout-block") {
    checkOptoutNumbers()
    $("#webhook-block").hide()
    $("#contact-block").hide()
  }
}

function readWebhookAddress(view){
  var url = "/readwebhook"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      $("#webhook-address").val(res.message.url)
      $("#header-name").val(res.message.headerName)
      $("#header-value").val(res.message.headerValue)
      webhook = res.message
      $("#contacts-block").hide()
      $(`#${view}`).show()
      if ($("#webhook-address").val() != ""){
        $("#delete-webhook").show()
        $("#set-webhook").hide()
        $("#copy-btn").show()
        $("#generator-btn").hide()
        setElementsHeight()
        showSampleCode($("#header-name").val(), $("#header-value").val())
      }else{
        $("#delete-webhook").hide()
        $("#set-webhook").show()
        $("#copy-btn").hide()
        $("#generator-btn").show()
      }
    }else if (res.status == "error"){
      _alert(res.message)
    }else{
      if (res.message)
        _alert(res.message)
      else{
        _alert("You have been logged out. Please login again.")
        window.setTimeout(function(){
          window.location.href = "/relogin"
        },8000)
      }
    }
  });
  getting.fail(function(response){
    _alert(response);
  });
}

function deleteWebhookAddress(){
  var url = "/deletewebhook"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      $("#webhook-address").val("")
      $("#header-name").val("")
      $("#header-value").val("")
      $("#delete-webhook").hide()
      $("#set-webhook").show()
      $("#copy-btn").hide()
      $("#generator-btn").show()
      $("#code").html("")
      //disableWebhookInputs(false)
    }else if (res.status == "error"){
      _alert(res.message)
    }else{
      if (res.message)
        _alert(res.message)
      else{
        _alert("You have been logged out. Please login again.")
        window.setTimeout(function(){
          window.location.href = "/relogin"
        },8000)
      }
    }
  });
  getting.fail(function(response){
    _alert(response);
  });
}

// template file input
function loadContactsFile(elm){
  var file = elm.files[0]
  if (file) {
    var reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function(e) {
      var contactsFromFile = e.target.result.trim().split("\r\n")
      var header = contactsFromFile[0]
      var columns = header.trim().split(",")
      displayColumns(columns)
    };
  }else{
    resetContactForm()
  }
}

function resetContactForm(){
  $("#number-column").val("")
  $("#fname-column").val("")
  $("#lname-column").val("")
  $("#group-name").val("")
  $("#columns").html("-")
  $("#columns-block").hide()
}

function displayColumns(columns){
  $("#columns-block").show()
  if (contactList.length > 0){
    $("#update-group-field").show()
  }
  var html = "|&nbsp;"
  for (var col of columns)
    html += `<a href="#" onclick="addToField('${col}');return false;">${col}</a>&nbsp;|&nbsp;`
  $("#columns").html(html)
}

function addToField(col){
  if ($("#number-column").val() == "")
    $("#number-column").val(col)
  else if ($("#fname-column").val() == "")
    $("#fname-column").val(col)
  else if ($("#lname-column").val() == "")
    $("#lname-column").val(col)
}

function updateContactList(){
  var html = ""
  var groups = ""
  for (var group of contactList){
    groups += `<option value="${group.groupName.replace(/\s/g, "-")}">${group.groupName}</option>`
  }
  $("#contact-groups").html(groups)
  $("#new-contact-groups").html(groups)
  $('#new-contact-groups').selectpicker('refresh');
  var contactGroup = contactList[0]
  selectedContactGroup = contactGroup.groupName
  for (var contact of contactGroup.contacts){
    html += `<div class="campaign-item">${formatPhoneNumber(contact.phoneNumber)} - ${contact.fname} ${contact.lname}</div>`
  }

  $("#contact-list").html(html)
}

function setContactGroupName(){
  var groupName = $("#new-contact-groups option:selected").text()
  $("#group-name").val(groupName)
}

function displayContacts(){
  var html = ""
  selectedContactGroup = $("#contact-groups option:selected").text()
  var contactGroup = contactList.find(o => o.groupName === selectedContactGroup)
  for (var contact of contactGroup.contacts){
    html += `<div class="campaign-item">${formatPhoneNumber(contact.phoneNumber)} - ${contact.fname} ${contact.lname}</div>`
  }
  $("#contact-list").html(html)
}

function uploadContactsFile(e){
  e.preventDefault();
  var form = $("#contact-form");
  var formData = new FormData(form[0]);

  $.ajax({
      url: "/uploadcontact",
      type: 'POST',
      data: formData,
      success: function (res) {
          if (res.status == "ok"){
            var contactGroup = undefined //contactList.find(o => o.groupName == res.contactList.groupName)
            var updated = false
            for (var i=0; i<contactList.length; i++){
              contactGroup = contactList[i]
              if (contactGroup.groupName == res.contactList.groupName){
                contactList[i] = res.contactList
                updated = true
                break
              }
            }
            if (!updated){
              contactList.push(res.contactList) //= contactList.concat(res.contactList)
            }
            if (contactList.length > 0){
              $("#my-contacts-pane").show()
              updateContactList()
            }
            // reset update form
            $("#csv-file").val("")
            resetContactForm()
          }else if (res.status == "error"){
            _alert(res.message)
          }else{
            _alert("You have been logged out. Please login again.")
            window.setTimeout(function(){
              window.location.href = "/relogin"
            },8000)
          }
      },
      cache: false,
      contentType: false,
      processData: false
  });
}

function readContacts(){
  var url = "get-contacts"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      contactList = res.contactList
      //alert(JSON.stringify(contactList))
      if (contactList.length > 0){
        $("#my-contacts-pane").show()
        updateContactList()
      }
    }else if (res.status == "error"){
      _alert(res.message)
    }else{
      _alert("You have been logged out. Please login again.")
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
}

function deleteWarning(){
  var r = confirm("Do you really want to delete all contacts?");
    if (r == true) {
      deleteAllContacts()
    }
}
function deleteAllContacts(){
  _alert("Delete all contacts will be coming soon", "Information")
}

function setWebhookAddress(){
  if ($("#webhook-address").val() == ""){
    return $("#webhook-address").focus()
  }
  var url = "setwebhook"
  var params = {
    address: $("#webhook-address").val(),
    header_name: $("#header-name").val(),
    header_value: $("#header-value").val()
  }
  var posting = $.post( url, params );
  posting.done(function( res ) {
    if (res.status == "ok"){
      _alert("WebHooks set successfullly", "Confirmation")
      $("#delete-webhook").show()
      //disableWebhookInputs(true)
      $("#set-webhook").hide()
      $("#copy-btn").show()
      $("#generator-btn").hide()
      showSampleCode($("#header-name").val(), $("#header-value").val())
      webhook = {
        url: $("#webhook-address").val(),
        headerName: $("#header-name").val(),
        headerValue: $("#header-value").val()
      }
    }else if (res.status == "error"){
      _alert(res.message)
    }else{
      if (res.message)
        _alert(res.message)
      else{
        _alert("You have been logged out. Please login again.")
        window.setTimeout(function(){
          window.location.href = "/relogin"
        },8000)
      }
    }
  });
  posting.fail(function(response){
    alert(response);
  });
}

function checkValueChange(){
  var valueChanged = false
  if (webhook.url){
    if (webhook.url != $(`#webhook-address`).val())
      valueChanged = true
    else if (webhook.headerName != $(`#header-name`).val())
      valueChanged = true
    else if (webhook.headerValue != $(`#header-value`).val())
      valueChanged = true

    if (valueChanged){
      $("#set-webhook").html('Update')
      $("#set-webhook").show()
    }else{
      $("#set-webhook").hide()
    }
  }else{
    ;
  }
}
/*
function disableWebhookInputs(flag){
  $("#webhook-address").prop("disabled", flag)
  $("#header-name").prop("disabled", flag)
  $("#header-value").prop("disabled", flag)
}
*/
function generateCode() {
  var text = "";
  var possible = "-~ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 1; i < 65; i++){
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  $("#header-value").val(text)
}

function checkOptoutNumbers(){
  var url = "/optout-numbers"
  var params = {
    fromNumber: $("#from-number").val()
  }
  var readingAni = "<img src='./img/logging.gif' style='width:50px;height:50px;display: block;margin:auto;'></img>"
  $("#opted-out-list").html(readingAni)
  var getting = $.get( url, params );
  getting.done(function( res ) {
    if (res.status == "ok"){
      optedOutNumbers = res.result
      if (optedOutNumbers.length > 0){
        $("#oo-numbers").show()
      }else{
        _alert("No opted out number!", "Information")
        $("#oo-numbers").hide()
      }
      setElementsHeight()
      var html = ""
      for (var number of optedOutNumbers){
        html += `<div class="campaign-item">${formatPhoneNumber(number, true)}</div>`
      }
      $("#opted-out-list").html(html)
    }else if (res.status == "error"){
      $("#opted-out-list").html("")
      _alert(res.message)
    }else{
      $("#opted-out-list").html("")
      if (res.message)
        _alert(res.message)
      else
        _alert("You have been logged out. Please login again.")
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
}

function copyOptoutNumbersToClipboard () {
    var dummy = document.createElement("textarea");
    document.body.appendChild(dummy);
    var text = ""
    for (var number of optedOutNumbers){
      text += `${number}\n`
    }
    dummy.value = text;
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);
}

function copyHeaderValue(){
  var copyText = document.getElementById("header-value");
  copyText.select();
  copyText.setSelectionRange(0, 99999);
  document.execCommand("copy");
}

function showSampleCode(key, value){
  var url = $("#webhook-address").val().replace("https://", "")
  var arr = url.split("/")
  var codeStr = `<label>Express Node JS sample code:</label> \
<xmp>\
var app = require('express')();
var server = require('http').createServer(app);
server.listen(8000);

app.post('/${arr[1]}', function(req, res) {\n\
    if(req.headers.hasOwnProperty('${key}')) {\n\
      if (req.headers['${key}'] == '${value}'){\n\
        var body = []\n\
        req.on('data', function(chunk) {\n\
            body.push(chunk);\n\
        }).on('end', function() {\n\
            body = Buffer.concat(body).toString()\n\
            var jsonObj = JSON.parse(body)\n\
            console.log(jsonObj)\n\
        })\n\
      }else{\n\
        console.log('Hacker post')\n\
      }\n\
    }else{\n\
      console.log('Spammer post.')\n\
    }\n\
    res.statusCode = 200\n\
    res.end()\n\
})\n\
</xmp>`
  $("#code").html(codeStr)
}
