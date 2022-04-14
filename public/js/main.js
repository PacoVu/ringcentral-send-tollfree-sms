var prevView = "create"
function init() {
  window.onresize = function() {
    setElementsHeight()
  }
  setElementsHeight()
  $(`#${mainMenuItem}`).removeClass("active")
  mainMenuItem = "help"
  $(`#${mainMenuItem}`).addClass("active")
}

function setElementsHeight(){
  var height = $(window).height() - $("#footer").outerHeight(true);
  var swindow = height - $("#menu_header").height()
  $("#menu-pane").height(swindow)
  $("#control-col").height(swindow)
  $("#create").height(swindow - 50)
}

function showView(view){
  if (prevView != ""){
    $(`#${prevView}`).hide()
    $(`#${prevView}-btn`).removeClass("active");
  }
  $(`#${view}`).show()
  $(`#${view}-btn`).addClass("active");
  prevView = view
}

function sendRequest(){
  var email = $("#email-address").val()
  var url = "invite-user"
  var params = {
    userInvite: email
  }
  var posting = $.post( url, params );
  posting.done(function( res ) {
    if (res.status == "ok"){
      alert("done")
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
