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
