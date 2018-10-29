Encompass.ProblemPermissionsService = Ember.Service.extend({
  base: Ember.inject.service('edit-permissions'),
  isPublic: function(problem) {
    return problem.get('privacySetting') === 'E';
  },
  isPrivate: function(problem) {
    return problem.get('privacySetting') === 'M';
  },

  isApproved(problem) {
    return problem.get('status') === 'approved';
  },



  canDelete(problem) {
     // undefined if no or bad argument passed in
     if (!problem) {
      return;
    }
    // if admin return true
    if (this.get('base.isAdmin')) {
      return true;
    }

    // if creator, return true
    if (this.get('base').isCreator(problem)) {
      return true;
    }

    // at this point user is neither admin nor creator

    // currently this means that any non PdAdmin would not be able to edit/delete

    if (!this.get('base.isPdAdmin')) {
      return false;
    }

    // non admins can only edit true public ('E') problems if they created the // problem

    if (this.isPublic(problem)) {
      return false;
    }

    // privacy setting can now only be 'O' or 'M'

    if (this.get('base.isPdAdmin')) {
      return this.get('base').doesRecordBelongToOrg(problem);
    }
  },

  canEdit(problem) {
     // undefined if no or bad argument passed in
     if (!problem) {
      return;
    }
    // if admin return true
    if (this.get('base.isAdmin')) {
      return true;
    }

    // if creator, return true
    if (this.get('base').isCreator(problem)) {
      return true;
    }

    // at this point user is neither admin nor creator

    // currently this means that any non PdAdmin would not be able to edit/delete

    if (!this.get('base.isPdAdmin')) {
      return false;
    }

    // non admins can only edit true public ('E') problems if they created the // problem

    if (this.isPublic(problem)) {
      return false;
    }

    // privacy setting can now only be 'O' or 'M'

    if (this.get('base.isPdAdmin')) {
      return this.get('base').doesRecordBelongToOrg(problem);
    }

  },

  canAssign(problem) {
    // undefined if no or bad argument passed in
    if (!problem) {
      return;
    }
    // if admin return true
    if (this.get('base.isAdmin')) {
      return true;
    }

    return this.isApproved(problem);

  },

  canPend(problem) {
    if (!problem) {
      return;
    }
    return this.get('base.isAdmin');
  },

  writePermissions(problem, isDeleteSameAsEdit=true) {
    let ret = {};

    let canDelete = this.canDelete(problem);
    ret.canDelete = canDelete;

    if (isDeleteSameAsEdit) {
      ret.canEdit = canDelete;
    } else {
      ret.canEdit = this.canEdit(problem);
    }

    ret.canAssign = this.canAssign(problem);
    ret.canPend = this.canPend(problem);

    return ret;
  },


});