var currentBatchId = ""
var pendingBatch = false
var isPolling = false
const SMS_COST = 0.007
const SMS_SEGMENT_LEN = 153
const SMS_MAX_LEN = 160
var totalRecipients = 0
var recipientsFromFile = []
var totalMessageSegments = 0
var sampleRow = null
var csvColumnIndex = {}
const MASK = "#!#"
var contactList = []
var optedOutNumbers = []

function hidePopover(elm){
  setTimeout(function () {
    elm.popover('hide');
  }, 2000);
}

function enableManualInput(elm){
  var option = $('input[name=enable_manual_input]:checked').val()
  if (option == "manual"){
    $("#manual-input").show()
    //$("#csv-option").css("visibility","hidden")
    if (contactList.length > 0)
      $("#contacts-block").show()
    $("#csv-option").hide()
    $("#recipient-phone-number").hide()
    $("#to-number-column").val("")
    $("#csv-template-columns").hide()
    $("#attachment").val("")
    $("#recipients").focus()
  }else{
    $("#csv-option").show()
    $("#manual-input").hide()
  }
}

function updateMsgPreviewAndEstimatedCost(){
  updateSampleMessage()
  var text = ""
  var id = ""
  for (var i=1; i<4; i++){
    id = `#command_${i}`
    text = $(id).val()
    if (text != "")
    break
  }

  if (text == "")
  $("#response-sample").hide()
  else{
    $("#response-sample").show()
    updateSurveyEstimatedCost(1)
  }
  $("#response-sample").html(text)

  $("#reply-sample").html("")
  var text = ""
  var i = 1
  for (i=1; i<4; i++){
    text = $(`#reply-${i}`).val()
    if (text != "")
    break
  }
  if (text == ""){
    $("#reply-sample").hide()
    updateSurveyEstimatedCost(1)
  }else{
    $("#reply-sample").show()
    updateSurveyEstimatedCost(2)
  }

  if ($("#reply-sample").html() == ""){
    var response = $(`#command_${i}`).val()
    $("#response-sample").html(response)
  }
  $("#reply-sample").html(text)
}

function updatePreview(field){
  if (field == "title"){
    $("#preview-campain-name").html($('#campaign-name').val())
  }else if (field == "from"){
    $("#preview-from-number").html(formatPhoneNumber($('#from-number').val()))
  }else if (field == "response"){
    var text = ""
    var id = ""
    for (var i=1; i<4; i++){
      id = `#command_${i}`
      text = $(id).val()
      if (text != "")
        break
    }
    // validate response text
    if (text != ""){
      if (text.indexOf(" ") >= 0){
        var pop = $(id)
        pop.popover('show');
        hidePopover(pop)
      }
    }

    if (text == "")
      $("#response-sample").hide()
    else{
      $("#response-sample").show()
      updateSurveyEstimatedCost(1)
    }
    $("#response-sample").html(text)
  }else if (field == "reply"){
    $("#reply-sample").html("")
    var text = ""
    var i = 1
    for (i; i<4; i++){
      text = $(`#reply-${i}`).val()
      if (text != "")
        break
    }
    if (text == ""){
      $("#reply-sample").hide()
      updateSurveyEstimatedCost(1)
    }else{
      $("#reply-sample").show()
      updateSurveyEstimatedCost(2)
    }

    if ($("#reply-sample").html() == ""){
        var response = $(`#command_${i}`).val()
        $("#response-sample").html(response)
    }
    $("#reply-sample").html(text)
  }
}

function checkOptoutNumbers(){
  var url = "/optout-numbers"
  var params = {
    fromNumber: $("#from-number").val()
  }
  var getting = $.get( url, params );
  getting.done(function( res ) {
    if (res.status == "ok"){
      optedOutNumbers = res.result
      if (recipientsFromFile.length >= 1){
        var col = $("#to-number-column").val()
        for (var i=1; i<recipientsFromFile.length; i++){
          var row = recipientsFromFile[i]
          row = detectAndHandleCommas(row)
          var cleanRow = row.trim().split(",")
          var number = cleanRow[csvColumnIndex[`${col}`]]
          number = (number[0] == "+") ? number : `+${number}`
          var optedOut = optedOutNumbers.indexOf(number)
          if (optedOut >= 0){
            alert(`This number ${number} is opted out`)
            recipientsFromFile.splice(i, 1)
          }
        }
        processCsvFileContent()
      }
    }else if (res.status == "error"){
      _alert(res.message)
    }else{
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

function updateSurveyEstimatedCost(multiply){
  var estimatedCost = totalRecipients * multiply * SMS_COST
  if (estimatedCost < 1.00)
    estimatedCost = estimatedCost.toFixed(3)
  else if (estimatedCost < 10.00)
    estimatedCost = estimatedCost.toFixed(2)
  else
    estimatedCost = estimatedCost.toFixed(1)
  $("#estimated-survey-cost").html(`$${estimatedCost} USD *`)
}

var currentBlock = 1
function createNewCampaign(){
  if (pollingBatchReportTimer)
    window.clearTimeout(pollingBatchReportTimer)
  if (pollingVoteResultTimer)
    window.clearTimeout(pollingVoteResultTimer)
  $("#history").hide()
  $("#create").show()
  currentBlock = 1
  $('#block_2').hide()
  $("#sms-form").show()
  $('#block_1').show()

  showBlock("preview")

  $("#submit").hide()
  $("#prevBtn").hide()
  $("#nextBtn").show()
  resetCampaignInput()
  resetCampaignPreview()
  if ($("#from-number option").length == 1)
    updatePreview("from")
}

function showBlock(block){
  switch (block){
    case "result":
    $("#preview-block").hide();
    $("#sms-form").hide();
    $("#result-block").show();
    break
    case "preview":
    $("#result-block").hide();
    $("#sms-form").show();
    $("#preview-block").show();
    if (contactList.length == 0)
    readContacts()
    if (templateList.length == 0)
    readTemplates()
    break
    case "history":
    $('#create').hide()
    $('#history').show()
    break
    default:
    $("#control-block").hide()
    break
  }
}

function readContacts(){
  var url = "get-contacts"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      contactList = res.contactList
      if (contactList.length > 0){
        var groups = ""
        for (var group of contactList){
          groups += `<option value="${group.groupName.replace(/\s/g, "-")}">${group.groupName}</option>`
        }
        $("#contact-groups").html(groups)
        $('#contact-groups').selectpicker('refresh');
      }
    }else if (res.status == "error"){
      _alert(res.message)
    }else{
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

function setRecipientFromContacts(){
  var groups = $('#contact-groups').val()
  var groupsName = $('#contact-groups option:selected').toArray().map(item => item.text).join();
  var groupsNameList = groupsName.split(",")
  var recipients = ""
  totalRecipients = 0
  if (groupsNameList.length == 0){
    $("#recipients").val(recipients)
    totalRecipients = 0 //contactGroup.contacts.length
    var sample = `${totalRecipients} recipients`
    $("#preview-recipients").html(sample)
    updateMsgPreviewAndEstimatedCost()
    return
  }

  var recipientsNumberList = []
  for (var selectedGroup of groupsNameList){
    var contactGroup = contactList.find(o => o.groupName === selectedGroup)
    if (contactGroup){
      for (var contact of contactGroup.contacts){
        var found = recipientsNumberList.find(o => o === contact.phoneNumber)
        if (found)
          continue
        recipientsNumberList.push(contact.phoneNumber)
        recipients += contact.phoneNumber + "\n"
      }
    }
  }
  recipients = recipientsNumberList.join("\n")
  $("#recipients").val(recipients)
  totalRecipients = recipientsNumberList.length
  var sample = `${totalRecipients} recipients`
  $("#preview-recipients").html(sample)
  updateMsgPreviewAndEstimatedCost()
}

function resetCampaignInput(){
  $("#campaign-name").val("")
  if ($("#from-number option").length > 1)
    $('#from-number option').prop("selected", false).trigger('change');
  else
    $('#from-number option').prop("selected", true).trigger('change');
  $("#enable-csv-template").prop('checked', true)
  $("#csv-option").show()
  $("#recipients").val("")
  $("#manual-input").hide()
  $("#recipient-phone-number").hide()
  $("#csv-template-columns").hide()
  $("#columns").html("")
  $("#template-columns").html("")
  $("#to-number-column").val("")
  $("#attachment").val("")
  $("#message").val("")
  $("#opt-out-instruction").prop('checked', false)
  $("#expect-response").prop('checked', false)
  $("#recipient-response-block").hide()
  $("#allow-correction").prop('checked', false)
  for (var i=1; i<4; i++){
    $(`#command_${i}`).val("")
    $(`#reply-${i}`).val("")
  }
  $("#campaign-name").focus()
}

function resetCampaignPreview(){
  $("#preview-campain-name").html("N/A")
  $("#preview-from-number").html("N/A")
  $("#preview-recipients").html("0")
  $("#charcount").html("SMS length: 0 char.")
  $("#sample").html("")
  $("#response-sample").html("")
  $("#response-sample").hide()
  $("#reply-sample").html("")
  $("#reply-sample").hide()
  $("#estimated_cost").html("$0.000 USD *")
}

function nextView(direction){
  var newBlock = currentBlock
  if (direction == "next")
    newBlock++
  else if(direction == "prev")
    newBlock--
  else
    return

  var view = `block_${newBlock}`
  switch (view) {
    case 'block_1':
      $('#block_2').hide()
      $("#prevBtn").hide()
      $("#nextBtn").show()
      $("#submit").hide()
      break;
    case 'block_2':
      if (checkCampainNameField() == false){
        var pop = $('#campaign-name')
        pop.popover('show');
        hidePopover(pop)
        return
      }
      if (checkFromField() == false){
        var pop = $('#from-number')
        pop.popover('show');
        hidePopover(pop)
        return
      }
      var check = $("#enable-manual-input").is(":checked")
      if (!check){
        if (!checkAttachmentField()){
          var pop = $('#attachment')
          pop.popover('show');
          hidePopover(pop)
          return
        }
        if ($("#to-number-column").val() == ""){
          var pop = $('#to-number-column')
          pop.popover('show');
          hidePopover(pop)
          $('#to-number-column').focus()
          return
        }
      }else{
        if ($("#recipients").val() == ""){
          var pop =$('#recipients')
          pop.popover('show');
          hidePopover(pop)
          return
        }
      }
      $('#block_1').hide()
      $("#nextBtn").hide()
      $("#prevBtn").show()
      $("#submit").show()
      setTimeout(function() {
        $('#message').focus();
      }, 0);
      break;
    default:
      return
  }
  currentBlock = newBlock
  $(`#${view}`).show()
}

function enableExpectingResponse(elm){
  if ($(elm).is(":checked")){
    $("#recipient-response-block").show()
    $("#survey-cost").show()
  }else{
    $("#recipient-response-block").hide()
    $("#survey-cost").hide()
    // clear sample response and auto reply
    for (var i=1; i<4; i++){
      $(`#command_${i}`).val("")
      $(`#reply-${i}`).val("")
    }
    $('#allow-correction').prop('checked', false)
    updatePreview('response')
    updatePreview('reply')
    $("#estimated-survey-cost").html("0.00 USD *")
  }
}

// manual input
function readFieldRecipients(elm){
  var dN = $(elm).val().trim()
  totalRecipients = dN.split("\n").length
  $("#preview-recipients").html(totalRecipients + " recipients")
  updateMsgPreviewAndEstimatedCost()
}
// template file input
function readCSVFile(elm){
  var file = elm.files[0]
  if (file) {
    var reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function(e) {
      recipientsFromFile = e.target.result.trim().split("\r\n")
      if (!isValidCSVContent()){
        _alert("Invalid .CSV format file!")
        $(elm).val("")
        return
      }
      processCsvFileContent()
    };
  }else{
    totalRecipients = 0
    $("#preview-recipients").html(totalRecipients + " recipient")
    totalMessageSegments = 0
    updateMsgPreviewAndEstimatedCost()
    $("#columns").html("-")
    $("#template-columns").html("-")
    $("#columns").hide()
    $("#recipient-phone-number").hide()
    $("#csv-template-columns").hide()
    //$("#opted-out-block").hide()
  }
}

function isValidCSVContent(){
  if (recipientsFromFile.length < 2){
    return false
  }else{
    var header = recipientsFromFile[0]
    var headerCols = header.trim().split(",")
    var firstRow = recipientsFromFile[1]
    var firstRowCols = firstRow.trim().split(",")
    if (headerCols.length != firstRowCols.length){
      return false
    }
  }
  return true
}

function processCsvFileContent(){
  var header = recipientsFromFile[0]
  var columns = header.trim().split(",")

  for (var i=0; i<columns.length; i++){
    csvColumnIndex[columns[i]] = i
  }
  var message = $("#message").val()
  totalRecipients = recipientsFromFile.length - 1
  $("#preview-recipients").html(totalRecipients + " recipients")
  if (recipientsFromFile.length >= 1){
    var row = recipientsFromFile[1]
    // need to detect double quotes from each col in a sample row
    row = detectAndHandleCommas(row)
    sampleRow = row.trim().split(",")
  }
  displayColumns(columns)
  $("#recipient-phone-number").show()
  $("#csv-template-columns").show()
  updateMsgPreviewAndEstimatedCost()
  //$("#opted-out-block").show()
}

// cost estimation
function calculateEstimatedCost(){
  var estimatedCost = totalMessageSegments * SMS_COST
  if (estimatedCost < 1.00)
    estimatedCost = estimatedCost.toFixed(3)
  else if (estimatedCost < 10.00)
    estimatedCost = estimatedCost.toFixed(2)
  else
    estimatedCost = estimatedCost.toFixed(1)
  var msg = `$${estimatedCost} USD *.`
  if (totalMessageSegments == 0)
    msg = "$0.00 USD *."
  $("#estimated_cost").html(msg)
}

function detectAndHandleCommas(row){
  var startPos = 0
  var endPos = 0
  while (startPos >= 0){
    startPos = row.indexOf('"', endPos)
    if (startPos > 0){
      endPos = row.indexOf('"', startPos+1)
      if (endPos >= 0){
        var colText = row.substring(startPos, endPos+1)
        var count = colText.split(",").length - 1
        var maskedText = colText.replace(/,/g, MASK);
        endPos = endPos + (2 * count)
        row = row.replace(colText, maskedText)
      }
      endPos = endPos+2
      if (endPos >= row.length)
        startPos = -1
    }
  }
  return row
}

function displayColumns(columns){
  $("#columns").show()
  var html = "|&nbsp;"
  var recipientCol = "|&nbsp;"
  var filled = false
  for (var col of columns){
    var value = sampleRow[csvColumnIndex[`${col}`]]
    if (!isNaN(value) && value.length >= 9){
      recipientCol += `<a href="#" onclick="addToRecipient('${col}');return false;">${col}</a>&nbsp;|&nbsp;`
      if (!filled){
        filled = true
        updateSampleRecipient(col)
      }
    }//else{
      // closed "else" to display number columns for selecting option to compose text message.
      html += `<a href="#" onclick="addToMessage('${col}');return false;">${col}</a>&nbsp;|&nbsp;`
    //}
  }
  $("#columns").html(recipientCol)
  $("#template-columns").html(html)
}

function checkPos(){
  var pos = 0;
  var el = document.getElementById("message")
  if("selectionStart" in el) {
     pos = el.selectionStart;
  } else if("selection" in document) {
     el.focus();
     var Sel = document.selection.createRange();
     var SelLength = document.selection.createRange().text.length;
     Sel.moveStart("character", -el.value.length);
     pos = Sel.text.length - SelLength;
  }
  return pos;
}

function updateSampleRecipient(columnName){
  var template = columnName
  if (columnName == undefined)
    template = $("#to-number-column").val()
  var value = sampleRow[csvColumnIndex[`${template}`]]
  if (isNaN(value)){
    $("#preview-recipients").html("")
    return _alert("Wrong column. Value is not a phone number!")
  }
  $("#to-number-column").val(template)
  var sample = `${totalRecipients} recipients ["${value}","..."]`
  $("#preview-recipients").html(sample)
}

function addToRecipient(template){
    updateSampleRecipient(template)
}

function addToMessage(template){
  var insertPos = checkPos()
  var msg = $("#message").val()
  var headMsg = msg.substring(0, insertPos).trim()
  var trailMsg = msg.substring(insertPos, msg.length)
  if (insertPos == msg.length)
    headMsg += ` {${template}}`
  else
    headMsg += ` {${template}} `
  msg = headMsg + trailMsg

  $("#message").val(msg)
  $("#message").focus()
  $("#message").val(msg + ' ')
  updateMsgPreviewAndEstimatedCost()
}

function addOptoutInstruction(elm){
  var msg = $("#message").val()
  if (elm.checked){
    msg += "\n\nReply STOP to opt-out."
  }else {
    msg = msg.replace("\n\nReply STOP to opt-out.", "")
  }
  $("#message").val(msg)
  $("#message").focus()
  updateMsgPreviewAndEstimatedCost()
}

function updateSampleMessage(){
  var msg = $("#message").val()
  if (msg.length > 0){
    $("#submit").prop('disabled', false);
  }else{
    $("#submit").prop('disabled', true);
  }
  let re = new RegExp('/\{([^}]+)\}/g');
  var arr = msg.match(/{([^}]*)}/g)
  if (arr){
    for (var pattern of arr){
      for (var key of Object.keys(csvColumnIndex)){
        var k = `{${key}}`
        if (k == pattern){
          var text = sampleRow[csvColumnIndex[key]].replaceAll('"', '')
          text = text.replaceAll(MASK, ',')
          msg = msg.replace(pattern, text)
        }
      }
    }
  }
  var sample = msg.replace(/\r?\n/g, "<br>")
  sample = qaTextMessage(sample)
  if (sample.length){
    $("#sample").show()
    $("#sample").html(sample)
  }else{
    $("#sample").hide()
  }

  $("#charcount").html("SMS length: " + msg.length + " chars.")

  totalMessageSegments = 1
  if (msg.length > SMS_MAX_LEN){
    totalMessageSegments = msg.length / SMS_SEGMENT_LEN
    totalMessageSegments = Math.ceil(totalMessageSegments)
  }else if (msg.length == 0)
    totalMessageSegments = 0
  totalMessageSegments *= totalRecipients
  calculateEstimatedCost()
}

function isUpperCase(str) {
  return str === str.toUpperCase();
}
function qaTextMessage(msg){
  if (isUpperCase(msg) && isNaN(msg)){
    msg = `<span class='caplock_warning'>${msg}</span>`
    $("#caplock_warning").show()
  }else{
    $("#caplock_warning").hide()
  }
  var tempMsg = msg.toLowerCase()
  var shortenLinks = [
    "https://bit.ly/",
    "https://ow.ly",
    "https://goo.gl/",
    "https://tinyurl.com/",
    "https://tiny.cc/",
    "https://bc.vc/",
    "https://budurl.com/",
    "https://clicky.me/",
    "https://is.gd/",
    "https://lc.chat/",
    "https://soo.gd/",
    "https://s2r.co/",
    "http://bit.ly/",
    "http://ow.ly",
    "http://goo.gl/",
    "http://tinyurl.com/",
    "http://tiny.cc/",
    "http://bc.vc/",
    "http://budurl.com/",
    "http://clicky.me/",
    "http://is.gd/",
    "http://lc.chat/",
    "http://soo.gd/",
    "http://s2r.co/",
  ]

  for (var link of shortenLinks){
    var index = tempMsg.indexOf(link)
    if (index >= 0){
      var temp = tempMsg.substring(index, tempMsg.length-1)
      var endIndex = temp.indexOf(" ")
      endIndex = (endIndex > 0) ? endIndex : temp.length+1
      var unsafeLink = msg.substr(index, endIndex)
      msg = msg.replace(unsafeLink, `<span class='unsafe_link_warning'>${unsafeLink}</span>`, "g")
      $("#unsafe_link_warning").show()
      break
    }else{
      $("#unsafe_link_warning").hide()
    }
  }
  return msg
}
/*
function disableSubmitBtn(flag){
  $("#submit").prop('disabled', flag);
}
*/
// submit form using ajax seems not enforce required inputs
function checkFromField(){
  if ($("#from-number").val() == ""){
    $("#from-number").focus()
    return false
  }
  return true
}

function checkToField(){
  var toNumberColumnName = $("#to-number-column").val()
  if (toNumberColumnName == ""){
    //_alert(`Please specify the column name for recipient phone number.`)
    $("#to-number-column").focus()
    return "Please specify the column name for recipient phone number."
    //return false
  }
  for (var key of Object.keys(csvColumnIndex)){
    if (key == toNumberColumnName){
      return ""
    }
  }
  //_alert(`Cannot find the "${$("#to-number-column").val()}" column from this .csv file.`)
  $("#to-number-column").focus()
  return `Cannot find the "${$("#to-number-column").val()}" column from this .csv file.`
  //return false
}

function checkToNumberField(){
  var toNumbers = $("#recipients").val()
  if (toNumbers == ""){
    $("#recipient").focus()
    return "Please enter recipient phone number."
  }
  return ""
}

function checkCampainNameField(){
  if ($("#campaign-name").val() == ""){
    $("#campaign-name").focus()
    return false
  }
  return true
}

function checkAttachmentField(){
  if ($("#attachment").val() == ""){
    $("#attachment").focus()
    return false
  }
  return true
}
function checkMessageField(){
  if ($("#message").val() == ""){
    $("#message").focus()
    return false
  }
  return true
}
/*
function _alert(message){
  $("#alert-message").html(message)
  $('#alert-dlg').modal('show')
}
*/
/*
function checkCommandFields(){
  var hasCommand = false
  var temp = $("#command_1").val().trim()
  if (temp != ""){
    if (temp.indexOf(" ") >= 0){
      //alert("Support a single word response only!")
      _alert("Support a single word response only!")
      $("#command_1").focus()
      return false
    }else
      hasCommand = true
  }

  temp = $("#command_2").val().trim()
  if (temp != ""){
    if (temp.indexOf(" ") >= 0){
      _alert("Support a single word response only!")
      $("#command_2").focus()
      return false
    }else
      hasCommand = true
  }

  temp = $("#command_3").val().trim()
  if (temp != ""){
    if (temp.indexOf(" ") >= 0){
      _alert("Support a single word response only!")
      $("#command_3").focus()
      return false
    }else
      hasCommand = true
  }
  if (!hasCommand){
    _alert("Please enter at least one response option!")
    $("#command_1").focus()
  }
  return hasCommand
}
*/
function checkCommandFields(){
  var hasCommand = false
  for (var i=1; i<4; i++){
    var temp = $(`#command_${i}`).val().trim()
    if (temp != ""){
      hasCommand = true
      if (temp.indexOf(" ") >= 0){
        _alert("Support <b>a single word</b> response only!", "Stop", `#command_${i}`)
        //$(`#command_${i}`).focus()
        return false
      }
    }else{
      if ($(`#reply-${i}`).val() != ""){
        _alert(`Please provide <b>a response word</b> for option ${i}!`, "Stop", `#command_${i}`)
        return false
      }
    }
  }
  if (!hasCommand){
    $('#command_1').focus()
    _alert("Please enter at least one response option!", "Stop", '#command_1')
  }
  return hasCommand
}

function sendBatchMessage(e) {
  e.preventDefault();
  if (pendingBatch){
    var r = confirm("You have a pending batch. Do you want to send a new batch before the previous batch completed?");
    if (r == true) {
      // cancel polling
      //if (isPolling)
      //  switchPollResult()
      startPollingResult(false)
      pendingBatch = false
      canSendMessages()
    }
  }else{
    canSendMessages()
  }
}

function canSendMessages() {
  if (checkCampainNameField() == false){
    return _alert("Please provide a campaign name!")
  }
  if ($("#enable-manual-input").is(":checked")){
    if (checkFromField() == false){
      return _alert("Please select a 'from' number!")
    }
  }else{
    if (checkToField() != ""){
      return
    }
    if (!checkAttachmentField()){
      return _alert("Please select a .csv file!")
    }
  }
  if (!checkMessageField()){
    return _alert("Please enter a message!")
  }
  if ($("#expect-response").is(":checked")){
    if (!checkCommandFields()){
      return //_alert("Please enter at least one response option!")
    }
  }

  var form = $("#sms-form");
  var formData = new FormData(form[0]);

  $.ajax({
      url: "/sendhvmessages",
      type: 'POST',
      data: formData,
      success: function (res) {
          if (res.status == "ok"){
            pendingBatch = true
            showBlock("result")
            parseResultResponse(res)
          }else if (res.status == "error"){
            _alert(res.message)
          }else{
            if (res.message)
              _alert(res.message)
            else
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

function pollResult(){
  if (currentBatchId == "")
    return
  var url = "get-batch-result?batchId=" + currentBatchId
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      parseResultResponse(res)
    }else if (res.status == "error"){
      _alert(res.message)
    }else{
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

function parseResultResponse(resp){
  var batchResult = resp.result
  currentBatchId = batchResult.id
  $("#status").html("Status: " + batchResult.status)
  //if (batchResult.status == "Processing"){
  if (batchResult.processedCount == 0){
    pendingBatch = true
    // show the time since batch request was submited
    $("#time").html("Duration: " + resp.time)
    var text = `<div>Sending ${batchResult.processedCount} out of ${batchResult.batchSize} messages.</div>`
    if (batchResult.rejectedNumbers.length){
      text += `<div class="error">Rejected: ${batchResult.rejectedNumbers.length} recipients.</div>`
      var rejectNumberList = "<h3>Invalid phone numbers</h3><div class='invalid-number-list'"
      for (var number of batchResult.rejectedNumbers){
        rejectNumberList += `<div>Index: ${number.index} - Number: ${number.to[0]} - Reason: ${number.description}`
      }
      $("#rejected-list-block").show()
      $("#rejected-list-block").html(rejectNumberList)
    }
    $("#result").html(text)
    pollTimer = window.setTimeout(function(){
      pollResult()
    }, 1000)
  //}else if (batchResult.status == "Completed" || batchResult.status == "Sent"){
  }else{
    pendingBatch = false
    startPollingResult(false)
    var createdAt = new Date(batchResult.creationTime).getTime()
    var lastUpdatedAt = new Date(batchResult.lastModifiedTime).getTime()
    var processingTime = (lastUpdatedAt - createdAt) / 1000
    $("#time").html("Duration : " + formatSendingTime(processingTime))
    var text = `<div>Sent: ${batchResult.processedCount} out of ${batchResult.batchSize} recipients.</div>`
    if (batchResult.rejectedCount){
      $("#download-reject-number").show()
    }else{
      showBlock("history")
      selectedBatchId = "" // force to display latest campaign
      readCampaigns()
    }
    $("#result").html(text)
  }
}

function startPollingResult(poll){
  if (poll){
    $("#sendingAni").css('display', 'inline');
    $("#polling-tips").css('display', 'inline');
    pollResult()
  }else{
    if (pollTimer)
      window.clearTimeout(pollTimer)
    pollTimer = null
    $("#sendingAni").css('display', 'none');
    $("#polling-tips").css('display', 'none');
  }
}


function showResult(flag){
  if (flag){
    $("#result-block").show()
    $("#sendingAni").css('display', 'inline');
  }else{
    $("#result-block").hide()
    $("#sendingAni").css('display', 'none');
  }
}

function downloadRejectedList(){
  var name = $("#campaign-name").val()
  var url = `download-invalid-number?batchId=${currentBatchId}&campaign_name=${encodeURIComponent(name)}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      window.location.href = res.message
    }else if (res.status == "error"){
      _alert(res.message)
    }else{
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

function switchToHistoryView(){
  showBlock("history")
  selectedBatchId = "" // force to display latest campaign
  readCampaigns()
}

function showEstimateCostClaimer(index){
  var text = [
    "Estimates are for educational purposes only and may not include all message fees, such as fees for international SMS. The actual cost for sending these messages may be higher or lower.",
    "Estimates are based on the assumption that every recipient would respond to the survey and including auto-reply message if it's set."
  ]
  _alert(text[index], "Information")
}


var templateList = []
var signatureList = []

function savedTemplates(){
  var msg = $("#message").val()
  if (msg.length == 0){
    return _alert("Message is empty!")
  }
  openCreateTemplateForm(msg)
}

function showSavedSignatures(){
  if (signatureList.length > 0){
    loadSignature()
  }else{
    var r = confirm("You don't have any saved signature. Do you want to create a signature?");
    if (r == true) {
      createSignature()
    }
  }
}

function setSignatureMessage(elm){
  var name = $(elm).val()
  var signature = signatureList.find(o => o.name == name)
  $("#saved-signature-message").val(unescape(signature.message));
}

function loadSignature(){
  var message = $('#load-signature-form');

  var signatures = ""
  for (var signature of signatureList){
    signatures += `<option value="${signature.name}">${signature.name}</option>`
  }
  $("#my-signatures").html(signatures)
  $('#my-signatures').selectpicker('refresh');
  $("#saved-signature-message").val("")

  BootstrapDialog.show({
      title: `<div style="font-size:1.2em;font-weight:bold;">My Signatures</div>`,
      message: message,
      draggable: true,
      onhide : function(dialog) {
        $('#hidden-div-load-signature').append(message);
      },
      buttons: [
      {
        label: 'New',
        cssClass: 'rc-oval-btn btn-left',
        action: function(dialog) {
          createSignature()
          dialog.close()
        }
      },{
        label: 'Delete',
        cssClass: 'rc-oval-btn btn-left',
        action: function(dialog) {
          deleteSignature()
        }
      },{
        label: 'Cancel',
        action: function(dialog) {
          dialog.close();
        }
      }, {
        label: "Use Signature",
        cssClass: 'btn btn-primary',
        action: function(dialog) {
          var msg = $("#message").val()
          msg += `\n\n${$("#saved-signature-message").val()}`
          $("#message").val(msg)
          $("#message").focus()
          updateMsgPreviewAndEstimatedCost()
          dialog.close()
        }
      }]
  });
  return false;
}

function deleteSignature(){
  var selectedName = $("#my-signatures").val()
  var index = signatureList.findIndex(o => o.name === selectedName)
  if (index >= 0){
    signatureList.splice(index, 1)
    var signatures = ""
    for (var signature of signatureList){
      signatures += `<option value="${signature.name}">${signature.name}</option>`
    }
    $("#my-signatures").html(signatures)
    $('#my-signatures').selectpicker('refresh');
    $("#saved-signature-message").val("")

    var url = "delete-template"
    var params = {
      name: selectedName,
      type: "signature"
    }
    var posting = $.post( url, params );
    posting.done(function( res ) {
      if (res.status == "ok"){
        ;
      }else if (res.status == "failed"){
        _alert(res.message)
      }else{
        _alert(res.message)
      }
    });
    posting.fail(function(response){
      _alert(response.statusText);
    });
  }
  return true
}

function setSignatureName(elm){
  $("#new-signature-name").val($(elm).val());
}

function createSignature(){
  var message = $('#create-signature-form');

  if (signatureList.length > 0 ){
    var signatures = ""
    for (var signature of signatureList){
      signatures += `<option value="${signature.name}">${signature.name}</option>`
    }
    $("#signatures-block").show()
    $("#signatures-list").html(signatures)
    $('#signatures-list').selectpicker('refresh');

  }

  BootstrapDialog.show({
      title: `<div style="font-size:1.2em;font-weight:bold;">Create Signature</div>`,
      message: message,
      draggable: true,
      onhide : function(dialog) {
        $('#hidden-div-create-signature').append(message);
      },
      buttons: [
      {
        label: 'Cancel',
        action: function(dialog) {
          dialog.close();
        }
      }, {
        label: "Save",
        cssClass: 'btn btn-primary',
        action: function(dialog) {
            var params = {
              type: "signature",
              name: $("#new-signature-name").val(),
              message: $("#new-signature-message").val(),
              requestResponse: '[]'
            }

            if (params.name == ""){
              $("#new-signature-name").focus()
              return _alert("Please enter a name!")
            }
            if (params.message == ""){
              $("#new-signature-message").focus()
              return _alert("Please enter signature message!")
            }
            signatureList.push(params)
            var url = "save-template"
            var posting = $.post( url, params );
            posting.done(function( res ) {
              if (res.status == "ok"){
                alert("saved")
                dialog.close();
              }else if (res.status == "failed"){
                _alert(res.message)
                dialog.close();
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

function readTemplates(){
  var url = "read-templates"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      if (res.templateList.length > 0){
        for (var item of res.templateList){
          if (item.type == "message")
            templateList.push(item)
          else
            signatureList.push(item)
        }
      }
      console.log(templateList)
      console.log(signatureList)
    }else if (res.status == "error"){
      _alert(res.message)
    }else{
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

function openCreateTemplateForm(msg){
  $("#templates-block").show()
  if ($("#templates-list").val() == ""){
    var templates = ""
    for (var template of templateList){
      templates += `<option value="${template.name}">${template.name}</option>`
    }
  }
  $("#templates-list").html(templates)
  $('#templates-list').selectpicker('refresh');
  $("#new-template-message").val(msg);
  if ($("#expect-response").is(":checked")){
    $("#template-recipient-response-block").show()
    for ( var i=1; i<4; i++){
      var command = $(`#command_${i}`).val()
      var reply = $(`#reply-${i}`).val()
      if (command.length > 0)
        $(`#template-command_${i}`).html(command)
      if (reply.length > 0)
        $(`#template-reply-${i}`).html(reply)
    }
  }

  var message = $('#create-template-form');

  $('#create-template-form').on('shown.bs.modal', function () {
    $("#new-template-message").val($("#messsage").val());
  })
  BootstrapDialog.show({
      title: `<div style="font-size:1.2em;font-weight:bold;">Save as template</div>`,
      message: message,
      draggable: true,
      onhide : function(dialog) {
        $('#hidden-div-save-template').append(message);
      },
      buttons: [{
        label: 'Cancel',
        action: function(dialog) {
          dialog.close();
        }
      }, {
        label: 'Save',
        cssClass: 'btn btn-primary',
        action: function(dialog) {
          var requestResponse = []
          if ($("#expect-response").is(":checked")){
            for ( var i=1; i<4; i++){
              var item = {
                command: $(`#command_${i}`).val(),
                reply: $(`#reply-${i}`).val()
              }
              requestResponse.push(item)
            }
          }
          var params = {
            type: "message",
            name: $("#new-template-name").val(),
            message: $("#new-template-message").val(),
            requestResponse:  JSON.stringify(requestResponse)
          }

          if (params.name == ""){
            $("#new-template-name").focus()
            return _alert("Please enter a template name!")
          }
          if (params.message == ""){
            $("#new-template-message").focus()
            return _alert("Please enter template message!")
          }
          templateList.push(params)
          var url = "save-template"
          var posting = $.post( url, params );
          posting.done(function( res ) {
            if (res.status == "ok"){
              alert("saved")
              dialog.close();
            }else if (res.status == "failed"){
              _alert(res.message)
              dialog.close();
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

function setTemplateName(elm){
  $("#new-template-name").val($(elm).val())
}

function deleteTempate(){
  var selectedName = $("#my-templates").val()
  var index = templateList.findIndex(o => o.name === selectedName)
  if (index >= 0){
    templateList.splice(index, 1)
    var templates = ""
    for (var template of templateList){
      templates += `<option value="${template.name}">${template.name}</option>`
    }
    $("#my-templates").html(templates)
    $('#my-templates').selectpicker('refresh');
    $("#saved-template-message").val("")
    for ( var i=1; i<4; i++){
      $(`#saved-template-command_${i}`).html("")
      $(`#saved-template-reply-${i}`).html("")
    }
    $("#saved-template-recipient-response-block").hide()
    var url = "delete-template"
    var params = {
      name: selectedName,
      type: "message"
    }
    var posting = $.post( url, params );
    posting.done(function( res ) {
      if (res.status == "ok"){
        ;
      }else if (res.status == "failed"){
        _alert(res.message)
      }else{
        _alert(res.message)
      }
    });
    posting.fail(function(response){
      _alert(response.statusText);
    });
  }
  return true
}

var selectedTemplate = undefined
function displaySelectTemplate(elm){
  var selectedName = $(elm).val()
  selectedTemplate = templateList.find(o => o.name === selectedName)
  if (selectedTemplate){
    $("#saved-template-message").val(unescape(selectedTemplate.message))
    if (selectedTemplate.requestResponse){
      var requestResponse = JSON.parse(selectedTemplate.requestResponse)
      if (requestResponse.length > 0){
        $("#saved-template-recipient-response-block").show()
        for ( var i=1; i<4; i++){
          if (requestResponse[i-1].command.length > 0){
            $(`#response-${i}`).show()
            $(`#saved-template-command_${i}`).html(requestResponse[i-1].command)
            $(`#saved-template-reply-${i}`).html(requestResponse[i-1].reply)
          }else
            $(`#response-${i}`).hide()
        }
      }else{
        for ( var i=1; i<4; i++){
          $(`#saved-template-command_${i}`).html("")
          $(`#saved-template-reply-${i}`).html("")
        }
        $("#saved-template-recipient-response-block").hide()
      }
    }else{
      for ( var i=1; i<4; i++){
        $(`#saved-template-command_${i}`).html("")
        $(`#saved-template-reply-${i}`).html("")
      }
      $("#saved-template-recipient-response-block").hide()
    }
  }
}

function showSavedTemplates(){
  if (templateList.length == 0){
    return
  }else{
    var templates = ""
    for (var template of templateList){
      templates += `<option value="${template.name}">${template.name}</option>`
    }
    $("#my-templates").html(templates)
    $('#my-templates').selectpicker('refresh');
  }
  var message = $('#load-template-form');
  BootstrapDialog.show({
      title: `<div style="font-size:1.2em;font-weight:bold;">Load a template</div>`,
      message: message,
      draggable: true,
      onhide : function(dialog) {
        $('#hidden-div-load-template').append(message);
      },
      buttons: [
      {
        label: 'Cancel',
        action: function(dialog) {
          dialog.close();
        }
      }, {
        label: 'Use Template',
        cssClass: 'btn btn-primary',
        action: function(dialog) {
          if (selectedTemplate){
            $("#message").val(unescape(selectedTemplate.message))
            if (selectedTemplate.requestResponse){
              var requestResponse = JSON.parse(selectedTemplate.requestResponse)
              if (requestResponse.length > 0){
                $('#expect-response').prop('checked', true)
                enableExpectingResponse($('#expect-response'))
                $("#recipient-response-block").show()
                for ( var i=1; i<4; i++){
                  $(`#command_${i}`).val(requestResponse[i-1].command)
                  $(`#reply-${i}`).val(requestResponse[i-1].reply)
                }
              }else{
                $('#expect-response').prop('checked', false)
                enableExpectingResponse($('#expect-response'))
              }
            }else{
              $('#expect-response').prop('checked', false)
              enableExpectingResponse($('#expect-response'))
            }
            updateMsgPreviewAndEstimatedCost()
          }
          dialog.close();
        }
      },{
        label: 'Delete Selected Template',
        cssClass: 'rc-oval-btn btn-left',
        action: function(dialog) {
          deleteTempate()
        }
      }]
  });
  return false;
}
