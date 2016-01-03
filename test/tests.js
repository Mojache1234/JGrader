var creds = require('../util/credentials');
creds.mysql_db = 'Jgrader-test';

describe('Unit tests', function() {
  require('./unit/util.specs');
  require('./unit/codeRunner.specs');
  require('./unit/comments.specs');
  require('./unit/teacher.specs');
  require('./unit/student.specs');
});
