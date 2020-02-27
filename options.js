function save_options() {
  var reporting = document.getElementById('report').checked;
  chrome.storage.sync.set({
    reporting: reporting
  }, function() {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
  });
}

function restore_options() {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.sync.get({
    reporting: true
  }, function(items) {
    document.getElementById('report').checked = items.reporting;
  });
}

document.addEventListener('DOMContentLoaded', restore_options);

document.getElementById('save').addEventListener('click', save_options);