var contactList = []
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
  $("#code").height(swindow - $("#webhook-inputs").outerHeight(true) - 30)
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
  }else if (view == "webhook-block") {
    if ($("#webhook-address").val() == ""){
      setElementsHeight()
      return readWebhookAddress(view)
    }else{
      $("#contacts-block").hide()
    }
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
        //disableWebhookInputs(true)
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
      else
        _alert("You have been logged out. Please login again.")
      window.setTimeout(function(){
        window.location.href = "/index"
      },8000)
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
      else
        _alert("You have been logged out. Please login again.")
      window.setTimeout(function(){
        window.location.href = "/index"
      },8000)
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
    $("#columns").html("-")
    $("#columns-block").hide()
  }
}
function displayColumns(columns){
  $("#columns-block").show()
  var html = "|&nbsp;"
  for (var col of columns)
    html += `<a href="javascript:addToField('${col}')">${col}</a>&nbsp;|&nbsp;`
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
  for (var contact of contactList){
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
            contactList = contactList.concat(res.contactList)
            updateContactList()
          }else if (res.status == "error"){
            _alert(res.message)
          }else{
            if (res.message)
              _alert(res.message)
            else
              _alert("You have been logged out. Please login again.")
            window.setTimeout(function(){
              window.location.href = "/index"
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
      if (contactList.length)
        $("#delete-contact-btn").show()
      updateContactList()
    }else if (res.status == "error"){
      _alert(res.message)
    }else{
      if (res.message)
        _alert(res.message)
      else
        _alert("You have been logged out. Please login again.")
      window.setTimeout(function(){
        window.location.href = "/index"
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
  _alert("Delete all contacts will be coming soon")
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
      else
        _alert("You have been logged out. Please login again.")
      window.setTimeout(function(){
        window.location.href = "/index"
      },8000)
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
