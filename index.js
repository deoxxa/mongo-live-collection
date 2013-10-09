var events = require("events"),
    mongo = require("mongoskin"),
    OplogWatcher = require("mongo-oplog-watcher");

var LiveCollection = module.exports = function LiveCollection(options) {
  Array.call(this);
  events.EventEmitter.call(this);

  var self = this;

  mongo.db([options.host || "localhost", options.database].join("/"), {safe: true}).collection(options.collection).find().toArray(function(err, docs) {
    if (err) {
      return self.emit("error", err);
    }

    docs.forEach(function(doc) {
      self.emit("insert", doc);
      self.push(doc);
    });

    var watcher = new OplogWatcher({
      host: options.host || "localhost",
      ns: [options.database, options.collection].join("."),
    });

    watcher.on("insert", function(doc) {
      self.emit("insert", doc);
      self.push(doc);
    });

    watcher.on("update", function(doc) {
      for (var i=0;i<self.length;++i) {
        if (self[i]._id.equals(doc._id)) {
          self.emit("change", self[i], doc);
          self[i] = doc;
        }
      }
    });

    watcher.on("delete", function(_id) {
      for (var i=0;i<self.length;++i) {
        if (self[i]._id.equals(_id)) {
          self.emit("remove", self[i]);
          self.splice(i, 1);
        }
      }
    });
  });
};
LiveCollection.prototype = Object.create(Array.prototype, {constructor: {value: LiveCollection}});

for (var k in events.EventEmitter.prototype) {
  LiveCollection.prototype[k] = events.EventEmitter.prototype[k];
}
