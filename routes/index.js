// Created by Brian Singer and Greg Carlin in 2015.
// Copyright (c) 2015 JGrader. All rights reserved.

var crypto = require('crypto');
var strftime = require('strftime');
var exec = require('child_process').exec;

require('./common');
var router = express.Router();
var db = require('../controllers/db');
var auth = require('../util/auth');
var email = require('../util/email');
var creds = require('../util/credentials');

// if hash is set to a valid user in the given db they are redirected to that section, otherwise finish is called.
var tryRedirect = function(hash, res, dbName, finish) {
  auth.logIn(hash, dbName + 's', function(id) {
    if (id) {
      res.redirect('/' + dbName);
    } else {
      finish();
    }
  });
};

/* GET home page. */
router.get('/', function(req, res) {
  var hash = req.cookies.hash;
  tryRedirect(hash, res, 'teacher', function() {
    tryRedirect(hash, res, 'student', function() {
      tryRedirect(hash, res, 'assistant', function() {
        res.render('index');
      });
    });
  });
});

router.get('/log-out', function(req, res) {
  var hash = req.cookies.hash;
  res.clearCookie('hash');
  // TODO only delete from where we need to?
  db.query("DELETE FROM `sessions-teachers` \
            WHERE `hash` = ?", [hash]);
  db.query("DELETE FROM `sessions-students` \
            WHERE `hash` = ?", [hash]);
  db.query("DELETE FROM `sessions-assistants` \
            WHERE `hash` = ?", [hash]);
  res.redirect('/');
});

router.get('/forgot', function(req, res) {
  res.render('forgot');
});

// calls finish(err, db) when done, err is null if there is no err, found is the database name if found, null if not found
var findEmail = function(email, finish) {
  var find = function(dbName, cb) {
    db.query("SELECT `id` \
              FROM `" + dbName + "` \
              WHERE `user` = ?", [email], function(err, rows) {
      if (err) {
        finish(err, null);
      } else if (rows.length >= 1) {
        finish(null, dbName, rows[0].id);
      } else {
        cb();
      }
    });
  };

  find('students', function() {
    find('teachers', function() {
      find('assistants', function() {
        finish(null, null, null);
      });
    });
  });
};

router.post('/forgot', function(req, res, next) {
  if (!req.body.email) {
    res.render('forgot', {error: 'All fields are required.'});
  } else {
    findEmail(req.body.email, function(err, dbName, id) {
      if (err) {
        res.render('forgot', {error: 'An unknown error has occurred.'});
        err.handled = true;
        return next(err);
      }

      if (!dbName || !id) {
        res.render('forgot', {error: 'No account with that address exists.'});
      } else {
        var hash = crypto.randomBytes(20).toString('hex');
        var url = 'http://jgrader.com/forgot/' + dbName + '/' + hash;
        db.query("UPDATE `" + dbName + "` \
                  SET `pass_reset_hash` = ? \
                  WHERE `id` = ?", [hash, id], function(err, result) {
          if (err) {
            res.render('forgot', {error: 'An unknown error has occurred.'});
            err.handled = true;
            return next(err);
          }

          var mailOptions = {
            to: req.body.email,
            subject: 'Password Recovery',
            html: ('Your password reset request has been received. ' +
                   'If you would like to reset your password, please go to ' +
                   '<a href="' + url + '">' + url + '</a>. ' +
                   'If you did not want to reset your password, ' +
                   'you can safely ignore this message.')
          };
          email.sendMail(mailOptions, function(err, info) {
            if (err) {
              res.render('forgot', {error: 'Unable to send email.'});
              err.handled = true;
              return next(err);
            }

            res.render('forgot', {
              success: 'An email has been sent with further instruction.'
            });
          });
        });
      }
    });
  }
});

router.get('/forgot/:db/:hash', function(req, res, next) {
  db.query("SELECT `id` FROM ?? WHERE `pass_reset_hash` = ?",
            [req.params.db, req.params.hash], function(err, rows) {
    if (err) {
      res.render('forgot', {error: 'An unknown error has occurred.'});
      // err might be caused by an incorrect database
      err.handled = true;
      return next(err);
    }

    if (rows.length <= 0) {
      res.render('forgot', {
        error: 'Your account could not be found. Please try again.'
      });
    } else {
      auth.signIn(req.params.db, rows[0].id, res, function(err, result) {
        if (err) {
          res.render('forgot', {error: 'An unknown error has occurred.'});
          err.handled = true;
          return next(err);
        }

        // user will be automatically redirected to their proper section
        res.redirect('/');
      });
    }
  });
});

router.get('/faq', function(req, res) {
  res.render('faq');
});

router.get('/privacy', function(req, res) {
  res.render('privacy');
});

router.get('/blog.rss', function(req, res, next) {
  db.query("SELECT `id`,`timestamp`,`title`,`author`,`contents` \
            FROM `blog` \
            ORDER BY `timestamp` DESC", [], function(err, rows) {
    if (err) {
      res.send('An unknown error has occurred.');
      err.handled = true;
      return next(err);
    }

    var o = '';
    o += '<?xml version="1.0" ?>\n';
    o += '<rss version="2.0">';
    o += '<channel>';
    o += '<title>jGrader Blog</title>';
    o += '<link>http://jgrader.com/blog</link>';
    o += '<description>';
    o += 'jGrader news, feature additions, and bug fixes.';
    o += '</description>';
    o += '<language>en-us</language>';
    o += '<copyright>Copyright 2015 Greg Carlin and Brian Singer</copyright>';
    o += '<managingEditor>contact@jgrader.com</managingEditor>';
    o += '<webMaster>contact@jgrader.com</webMaster>';
    for (var i in rows) {
      o += '<item>';
      o += '<title>' + rows[i].title + '</title>';
      o += '<link>http://jgrader.com/blog/' + rows[i].id + '</link>';
      o += '<description>' + rows[i].contents + '</description>';
      o += '<guid isPermaLink="true">';
      o += 'http://jgrader.com/blog/' + rows[i].id;
      o += '</guid>';
      o += '<pubDate>';
      o += strftime('%a, %d %b %Y %H:%M:%S %Z', rows[i].timestamp);
      o += '</pubDate';
      o += '</item>';
    }
    o += '</channel>';
    o += '</rss>';
    res.send(o);
  });
});

router.get('/blog', function(req, res, next) {
  db.query("SELECT `timestamp`,`title`,`author`,`contents` \
            FROM `blog` \
            ORDER BY `timestamp` DESC", [], function(err, rows) {
    if (err) {
      res.render('blog', {
        error: 'An unknown error has occurred.',
        posts: [],
        strftime: strftime
      });
      err.handled = true;
      return next(err);
    }

    res.render('blog', {posts: rows, strftime: strftime});
  });
});

router.post('/git-update', function(req, res, next) {
  var hmac = 'sha1=' +
    crypto.createHmac('sha1', creds.git_secret)
          .update(req.rawBody)
          .digest('hex');
  if (req.headers['x-hub-signature'] == hmac) {
    exec('git pull', {}, function(error, stdout, stderr) {
      if (error) {
        res.json(error);
        error.handled = true;
        return next(error);
      }

      res.json({stdout: stdout, stderr: stderr});
    });
  } else {
    res.json({stderr: 'Invalid secret.'});
  }
});

module.exports = router;
