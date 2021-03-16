var prevView = "create"
function init() {
  var height = $(window).height() - $("#footer").outerHeight(true);
  window.onresize = function() {
    var height = $(window).height() - $("#footer").outerHeight(true);
    height = $(window).height() - $("#footer").outerHeight(true)
    var swindow = height - $("#menu_header").outerHeight(true)
    //$("#history-list-column").height(swindow - $("#history-info-block").outerHeight(true))
    //var upperBlock = $("#history-info-block").outerHeight(true) + $("#history-header").outerHeight(true) + 50
    //$("#history-list").height(swindow - upperBlock)

    $("#menu-pane").height(swindow)
    $("#control-col").height(swindow)
  }
  var swindow = height - $("#menu_header").height()
  $("#menu-pane").height(swindow)
  $("#control-col").height(swindow)
  $(`#${mainMenuItem}`).removeClass("active")
  mainMenuItem = "help"
  $(`#${mainMenuItem}`).addClass("active")
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
