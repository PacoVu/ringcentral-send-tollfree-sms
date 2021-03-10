var webhookAddress = ""
var userKey = ""
function init(){

  var footer = $("#footer").height()
  var height = $(window).height() - 80;
    window.onresize = function() {
        height = $(window).height() - 80;
        var swindow = height - $("#menu_header").height()
        $("#menu-pane").height(swindow)
        $("#control-col").height(swindow)
    }
    var swindow = height - $("#menu_header").height()
    $("#menu-pane").height(swindow)
    $("#control-col").height(swindow)
}

function showView(view){
  if (view == "contacts-block"){
    $("#webhook").hide()
  }else if (view == "webhook") {
    if (webhookAddress == "")
      return readWebhookAddress(view)
    else{
      $("#contacts-block").hide()
    }
  }
  $(`#${view}`).show()
}

function readWebhookAddress(view){
  var url = "/readwebhook"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      console.log("ok")
      $("#webhook-address").val(res.message.url)
      $("#header-name").val(res.message.headerName)
      $("#header-value").val(res.message.headerValue)
      $("#contacts-block").hide()
      $(`#${view}`).show()
      if (webhookAddress != "")
        $("#delete-webhook").show()
      else
        $("#delete-webhook").hide()
    }else if (res.status == "failed"){
      alert(res.message)
    }else{
      alert(res.message)
    }
  });
  getting.fail(function(response){
    alert(response);
  });
}

function deleteWebhookAddress(){
  var url = "/deletewebhook"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      console.log("ok")
      webhookAddress = ""
      userKey = ""
      $("#webhook-address").val(webhookAddress)
      $("#user-key").val(userKey)
      if (webhookAddress != "")
        $("#delete-webhook").show()
      else
        $("#delete-webhook").hide()
    }else if (res.status == "failed"){
      alert(res.message)
    }else{
      alert(res.message)
    }
  });
  getting.fail(function(response){
    alert(response);
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
            alert("ok")
          }else if (res.status == "failed"){
            alert(res.message)
            window.location.href = "login"
          }else{
            alert(res.message)
          }
      },
      cache: false,
      contentType: false,
      processData: false
  });
}

function readContacts(){
  if (message == ""){
    $("#send-text").focus()
    return alert("Please enter text message!")
  }
  if (params.from == ""){
    if (!$("#my-numbers").val()){
      return alert("please select the 'from' number")
    }else{
      params.from = $("#my-numbers").val()
    }
  }
  params.message = message
  //return alert(JSON.stringify(params))
  var url = "readcontacts"
  var posting = $.post( url, params );
  posting.done(function( res ) {
    if (res.status == "ok"){
      console.log("ok")
    }else if (res.status == "failed"){
      alert(res.message)
    }else{
      alert(res.message)
    }
  });
  posting.fail(function(response){
    alert(response);
  });
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
      //$("#user-key-block").show()
      //$("#user-key").val(res.message)
    }else if (res.status == "failed"){
      alert(res.message)
    }else{
      alert(res.message)
    }
  });
  posting.fail(function(response){
    alert(response);
  });
}

function copyUserKey(){
  var copyText = document.getElementById("user-key");
  copyText.select();
  copyText.setSelectionRange(0, 99999);
  document.execCommand("copy");
}

function logout(){
  window.location.href = "index?n=1"
}
