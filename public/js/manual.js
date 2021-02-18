var currentBatchId = ""
var pendingBatch = false
var isPolling = false
const SMS_COST = 0.007
const SMS_SEGMENT_LEN = 153
const SMS_MAX_LEN = 160

function init(){
  var jsonObj = JSON.parse(window.batchResult)
  if (jsonObj.status == "Processing" && jsonObj.id != ""){
    pendingBatch = true
    currentBatchId = jsonObj.id
    isPolling = false // force to start polling
    startPollingResult(true)
    //pollResult()
  }else{
    $("#control_block").hide()
  }
  $("#groups_list").selectpicker('hide')
}

function readFieldRecipients(elm, index){
    var dN = $(elm).val().trim()
    for (var g of groups){
      if (index == g.groupNumber){
        if (dN.length)
          g.fieldRecipients = dN.split("\n").length
        else
          g.fieldRecipients = 0
        break
      }
    }
    calculateEstimatedCost()
}

function readFileRecipients(elm, index){
  var file = elm.files[0]
  if (file) {
    var reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function(e) {
      var numbersFromFile = e.target.result.trim().split("\r\n")
      numbersFromFile.shift()
      for (var g of groups){
        if (index == g.groupNumber){
          g.fileRecipients = numbersFromFile.length
          break
        }
      }
      calculateEstimatedCost()
    };
  }else{
    for (var g of groups){
      if (index == g.groupNumber){
        g.fileRecipients = 0
        break
      }
    }
    calculateEstimatedCost()
  }
}

function countCharacter(elm, index){
  var text = $(elm).val()
  $("#charcount_"+index).html("SMS length: " + text.length + " chars.")
  for (var g of groups){
    if (index == g.groupNumber){
      g.charCount = text.length
      break
    }
  }
  calculateEstimatedCost()
}
// cost estimation
function calculateEstimatedCost(){
  var estimatedCost = 0
  var totalRecipients = 0
  var totalMessages =0
  for (var g of groups){
    var numberOfRecipients = g.fieldRecipients + g.fileRecipients
    if (g.charCount == 0) continue
    var coef = 1
    if (g.charCount > SMS_MAX_LEN){
      coef = g.charCount / SMS_SEGMENT_LEN
      coef = Math.ceil(coef)
    }
    var numberOfMessages = numberOfRecipients * coef
    totalMessages += numberOfMessages
    totalRecipients += numberOfRecipients
  }
  estimatedCost = totalMessages * SMS_COST
  var msg = `You are about to send a total of ${totalMessages} messages to ${totalRecipients} recipients.<br/>Your estimated cost will be $${estimatedCost.toFixed(3)} USD *.`
  if (totalMessages == 0)
    msg = "$0.000 USD *."
  $("#estimated_cost").html(msg)
}
/// cost estimation ends

var group = 0
var currentGroup = 0
var groups = [
  {
    groupNumber: 0,
    groupName: "",
    charCount: 0,
    fileRecipients: 0,
    fieldRecipients: 0
  }
]
// use to upload file directly.
function addCustomizedMessage(e){
  e.preventDefault()
  // should check if message and numbers are entered
  if (group > 0){
    if (checkToRecipientsInputs(group) == false){
      return alert("Please enter recipients number or select from a .csv file!")
    }
    if (checkMessageInputs(group) == false){
      return alert("Please enter text message!")
    }
  }
  group++
  var item = {
    groupNumber: group,
    groupName: "",
    charCount: 0,
    fileRecipients: 0,
    fieldRecipients: 0
  }
  groups.push(item)

  var groupIndex = ($("#group_index").val() == "") ? group : $("#group_index").val() + "_" + group
  $("#group_index").val(groupIndex)

  var newGroup = '<div id="g_'+ group + '" class="group_block"><img class="corner" src="./img/close.png" onclick="deleteWarning(\'g_' + group + '\',' + group + ')"></img>'
  newGroup += '<div class="block_space"><label class="label-input">To numbers</label>'
  newGroup += '<textarea rows="4" cols="14" id="recipients_'+group+'" name="recipients_'+group+'" onchange="readFieldRecipients(this,'+group+')" placeholder="+11234567890&#10;+14087654322&#10;+16501234567" class="form-control text-input"></textarea>'
  newGroup += '&nbsp;&nbsp;&nbsp;'
  newGroup += '<label class="label-column">Or, load from .csv file (single column with header row)</br>'
  newGroup += '<input type="file" id="attachment_'+group+'" name="attachment_'+group+'" onchange="readFileRecipients(this,'+group+')"></input>'
  newGroup += '</label></div>'
  newGroup += '<div class="block_space"><label class="label-input">Message</br><div class="char-count" id="charcount_'+group+'">SMS length: 0 char.</div></label>'
  newGroup += '<textarea rows="3" cols="60" id="message_'+group+'" name="message_'+group+'" oninput="countCharacter(this, '+group+')" class="form-control text-input"></textarea>&nbsp;&nbsp;'
  newGroup += '</div></div>'
  $("#groups").append(newGroup);

  for (var i=1; i < groups.length; i++){
    var name = i//+1
    groups[i].groupName = "Message group - " + name.toString()
  }
/*
  $("#groups_tab").empty()
  for (var g of groups){
    var page = '<div id="tab_'+g.groupNumber+'" class="tab_item"><a href="javascript:showGroup('+g.groupNumber+')">' + (g.groupName ) + '</a>&nbsp;&nbsp;</div>'
    $("#groups_tab").append(page);
  }
*/
  $("#groups_list").empty()
  //for (var g of groups){
  for (var n=1; n < groups.length; n++){
    var g = groups[n]
    $("#groups_list").append(($('<option>', {
        value: g.groupNumber,
        text : g.groupName
    })));
  }
  // hide old group
  var len = $('#groups_list > option').length;
  if (len > 1){
    var g = "#g_"+ (group-1).toString()
    $(g).hide()
    $("#groups_list").selectpicker('show')
    $('#groups_list').val(group);
  }else{
    $("#groups_list").selectpicker('hide')
  }
  $('#groups_list').selectpicker('refresh');
  // show new group
  $("#g_"+group).show()
  currentGroup = group
  $("#recipients_"+group).focus()
}

function showGroup(){
  // hide current group
  var groupNum = $("#groups_list").val()
  if (groupNum == 0) return
  $("#g_"+currentGroup).hide()
  var g = "#g_"+ groupNum
  $(g).show()
  currentGroup =  $("#groups_list option:selected").val()
}

// remove a customized group
function deleteWarning(block, index){
  var r = confirm("Do you really want to delete this message group?");
    if (r == true) {
      removeMe(block, index)
    }
}

function removeMe(block, index){
  $("#"+block).remove()
  var indexes = $("#group_index").val().split("_")
  var groupIndex = indexes.filter(function(e) { return e !== index.toString() })
  var indexesString = groupIndex.join("_")
  $("#group_index").val(indexesString)

  // remove group from groups
  groups.splice(groups.findIndex(item => item.groupNumber === index), 1)
  for (var i=1; i < groups.length; i++){
    var name = i//+1
    groups[i].groupName = name.toString()
  }
  $("#groups_list").empty()
  //for (var g of groups){
  for (var n=1; n < groups.length; n++){
    var g = groups[n]
    $("#groups_list").append(($('<option>', {
        value: g.groupNumber,
        text : "Message group - " + g.groupName
    })));
  }
  // keep group index
  $('#groups_list').selectpicker('refresh');
  //$("#groups_list option:selected").remove()

  var len = $('#groups_list > option').length;
  if (len == 0){
    $("#groups_list").selectpicker('hide')
  }if (len == 1){
    $("#groups_list").selectpicker('hide')
    $("#groups_list").val($("#groups_list option:first").val());
    currentGroup = $("#groups_list").val()
  }else{
    //$('#groups_list').val(1);
    $("#groups_list").val($("#groups_list option:first").val());
    currentGroup = $("#groups_list").val()
  }
  // show first group from group tab
  $("#groups").children().first().show()
  // recalculate cost estimation
  calculateEstimatedCost()
}

// submit form using ajax seems not enforce required inputs
function checkMessageInputs(g){
  if ($("#message_" + g).val() == ""){
    $("#message_" + g).focus()
    return false
  }
  return true
}
function checkToRecipientsInputs(g){
  if ($("#recipients_" + g).val() == "" && $("#attachment_" + g).val() == ""){
    $("#recipients_" + g).focus()
    return false
  }
  return true
}
function checkFromField(){
  if ($("#from_number").val() == null){
    $("#from_number").focus()
    return false
  }
  return true
}
function checkCampainNameField(){
  if ($("#campaign_name").val() == ""){
    $("#campaign_name").focus()
    return false
  }
  return true
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
  $("#result_block").hide()
  if (checkCampainNameField() == false){
    return alert("Please provide a campaign name.")
  }
  if (checkFromField() == false){
    return alert("Please select a High Volume SMS number.")
  }
  if (group == 0){ // check minimum the main text and recipient number are set
    if (checkToRecipientsInputs(0) == false){
      return alert("Please enter recipients number or select from a .csv file!")
    }
    if (checkMessageInputs(0) == false){
      return alert("Please enter text message!")
    }
  }
  var form = $("#sms-form");
  var formData = new FormData(form[0]);
  $.ajax({
      url: "/sendbroadcastmessages",
      type: 'POST',
      data: formData,
      success: function (res) {
          if (res.status == "ok"){
            pendingBatch = true
            isPolling = false // force to start polling
            currentBatchId = res.result.id
            startPollingResult(true)
            parseResultResponse(res)
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
