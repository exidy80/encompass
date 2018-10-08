/**
  * # Comment API
  * @description This is the API for comment based requests
  * @author Damola Mabogunje <damola@mathforum.org>
  * @since 1.0.0
  */
/* jshint ignore:start */
//REQUIRE MODULES
const _ = require('underscore');
const logger = require('log4js').getLogger('server');

//REQUIRE FILES
const models   = require('../schemas');
const userAuth = require('../../middleware/userAuth');
const utils    = require('../../middleware/requestHandler');
const wsAccess   = require('../../middleware/access/workspaces');
const access   = require('../../middleware/access/comments');

module.exports.get = {};
module.exports.post = {};
module.exports.put = {};

/**
  * @public
  * @method getComments
  * @description __URL__: /api/comments
  * @returns {Object} A 'named' array of comment objects
  * @throws {NotAuthorizedError} User has inadequate permissions
  * @throws {InternalError} Data retrieval failed
  * @throws {RestError} Something? went wrong
  */
async function getComments(req, res, next) {
  var user = userAuth.requireUser(req);
  var criteria;

  var ids = req.query.ids;
  try {
    if (ids) {
      criteria = await access.get.comments(user, ids);
    } else {
      criteria = await access.get.comments(user, null);
    }
  }catch(err) {
    console.error('error getComments', err);
    console.trace();
  }

  var textSearch = req.query.text;

  // Determine what comments can be searched
  if(textSearch) {
    var regExp = new RegExp(textSearch, 'i');
    criteria.text = regExp;
  }

  var myCommentsOnly = (req.query.myCommentsOnly === 'true');
  if(myCommentsOnly) {
    criteria.createdBy = user._id;
  }

  var sinceDate = req.query.since;
  if (sinceDate) {
    let isoDate = new Date(sinceDate);
    criteria.createDate = {$gte: isoDate};
  }

  var workspaces = req.query.workspaces;

  if(workspaces) {
    criteria.workspace = {$in: req.query.workspaces};
  }

  //see comment on ENC-488 this isn't gonna work (need JOIN/multiple queries or denormalization)
  //var selectionTextSearch = req.query.selectionText;
  //if(selectionTextSearch) {
  //  var regExp = new RegExp(selectionTextSearch, 'i');
  //  searchCriteria.$or.push({text: regExp});
  //}

  models.Comment.find(criteria)
    .populate('selection')
    .populate('submission')
    .populate('workspace')
    .populate('createdBy')
    .exec(function(err, comments) {
      if(err) {
        logger.error(err);
        return utils.sendError.InternalError(err, res);
      }

      var data = {'comments': []};
      var dataMap = {'createdBy': 'user'};
      var relatedData = {
        'selection': {},
        'submission': {},
        'workspace': {},
        'createdBy': {}
      };

      //this would probably be better done as an aggregate?
      //we're just massaging the data into an ember friendly format for side-loading
      comments.forEach(function(comment) {
        _.keys(relatedData).forEach(function(key){
          if(comment[key]){
            relatedData[key][comment[key]._id] = comment[key];
            comment[key] = comment[key]._id;
          } else {
            logger.error('comment ' + comment._id + ' missing ' + key);
            delete comment.key;
          }
        });
        data.comments.push(comment);
      });

      _.keys(relatedData).forEach(function(key){
        var modelName = key;
        if(dataMap[key]) {
          modelName = dataMap[key];
        }
        data[modelName] = _.values(relatedData[key]);
      });
      utils.sendResponse(res, data);
    });
}

/**
  * @public
  * @method getComment
  * @description __URL__: /api/comments/:id
  * @returns {Object} A 'named' comment object
  * @throws {NotAuthorizedError} User has inadequate permissions
  * @throws {InternalError} Data retrieval failed
  * @throws {RestError} Something? went wrong
  */
function getComment(req, res, next) {
  models.Comment.findById(req.params.id)
    .exec(function(err, comment) {
      if(err) {
        logger.error(err);
        return utils.sendError.InternalError(err, res);
      }

      var data = {'comment': comment};
      utils.sendResponse(res, data);
    });
}

/**
  * @public
  * @method postComment
  * @description __URL__: /api/comments
  * @throws {NotAuthorizedError} User has inadequate permissions
  * @throws {InternalError} Data saving failed
  * @throws {RestError} Something? went wrong
  */
function postComment(req, res, next) {
  var user = userAuth.requireUser(req);
  var workspaceId = req.body.comment.workspace;
  models.Workspace.findById(workspaceId).lean().populate('owner').populate('editors').exec(function(err, ws){
    if (err) {
      logger.error(err);
      return utils.sendError.InternalError(err, res);
    }
    if(wsAccess.canModify(user, ws)) {
      var comment = new models.Comment(req.body.comment);
      comment.createdBy = user;
      comment.createDate = Date.now();
      comment.save(function(err, doc) {
        if(err) {
          logger.error(err);
          return utils.sendError.InternalError(err, res);
        }
        var data = {'comment': doc};
        utils.sendResponse(res, data);
      });
    } else {
      logger.info("permission denied");
      res.send(403, "You don't have permission for this workspace");
    }
  });
}

/**
  * @public
  * @method putComment
  * @description __URL__: /api/comments/:id
  * @throws {NotAuthorizedError} User has inadequate permissions
  * @throws {InternalError} Data update failed
  * @throws {RestError} Something? went wrong
  */
function putComment(req, res, next) {

  var user = userAuth.requireUser(req);
  var workspaceId = req.body.comment.workspace;
  models.Workspace.findById(workspaceId).lean().populate('owner').populate('editors').exec(function(err, ws){
    if (err) {
      logger.error(err);
      return utils.sendError.InternalError(err, res);
    }
    if(wsAccess.canModify(user, ws)) {

      models.Comment.findById(req.params.id,
        function (err, doc) {
          if(err) {
            logger.error(err);
            return utils.sendError.InternalError(err, res);
          }

          for(var field in req.body.comment) {
            if((field !== '_id') && (field !== undefined)) {
              doc[field] = req.body.comment[field];
            }
          }
          doc.save(function (err, comment) {
            if(err) {
              logger.error(err);
              return utils.sendError.InternalError(err, res);
            }

            var data = {'comment': comment};
            utils.sendResponse(res, data);
          });
        }
      );
    } else { //not permitted
      logger.info("permission denied");
      // res.send(403, "You don't have permission for this workspace");
      return utils.sendError.NotAuthorizedError(`You don't have permission for this workspace`);
    }
  });
}

module.exports.get.comments = getComments;
module.exports.get.comment = getComment;
module.exports.post.comment = postComment;
module.exports.put.comment = putComment;
/* jshint ignore:end */