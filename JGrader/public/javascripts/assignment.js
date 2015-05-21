var url = document.URL;
var lastChar = url.charAt(url.length-1);
if(lastChar == '#') {
  url = url.substring(0, url.length - 1) + '/';
} else if(lastChar != '/') {
  url += '/';
}
$('#dropzone').dropzone({
  url: url + 'add',
  clickable: '#dropzone a',
  previewTemplate: '<span class="fa fa-spinner fa-spin"></span>',
  init: function() {
    this.on('success', function(file, response) {
      switch(response.code) {
        case 0:
          window.location.reload();
          break;
        default:
          alert('An unknown error has occurred. Please reload the page and try again.');
          break;
      }
    });
  }
});
