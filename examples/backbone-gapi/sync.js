/**
 * Created with IntelliJ IDEA.
 * User: kyawtun
 * Date: 1/4/13
 * Time: 1:39 PM
 * To change this template use File | Settings | File Templates.
 */



tasksService = new ydn.gapi.Client(tasks_api_format);

var schema = {
  stores: [
    {
      name: 'feed',
      keyPath: 'id',
      type: 'TEXT'
    }, {
      name: 'entry',
      keyPath: 'id',
      type: 'TEXT'
    }]
};
$.db = new ydn.db.Storage('backbone-sync-1', schema);


var taskLists;
/**
 *
 */
runApp = function() {
  tasksService.TaskLists.client.list(function(result) {
    taskLists = result;
    console.log(taskLists);
    var ele = document.getElementById('task-list');
    for (var i = 0; i < taskLists.length; i++) {
      var lists = taskLists[i];
      var view = new FeedView({model: lists, id: lists.id});
      ele.appendChild(view.render().el);
      var arg = {
        tasklist: lists.get('id')
      };
      tasksService.Tasks.client.list(function(tasks) {
        console.log(tasks);

      }, arg);
    }
  });

};