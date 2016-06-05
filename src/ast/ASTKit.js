var util = require('util');
var ASTNode = require('./ASTNode');
var Empty = require('./Empty');
var List = require('./List');

function ASTKit () {
}

function construct (constructor, args) {
  function F () {
    return constructor.apply(this, args);
  }
  F.prototype = constructor.prototype;
  return new F();
}

ASTKit.prototype.addNodeType = function (name, propMap) {
  // Convert map of property specs to array
  var propSpec = [];
  var propName;
  for (propName in propMap) {
    propMap[propName].name = propName;
    propSpec.push(propMap[propName]);
  }

  function Subclass () {
    var self = this;
    this.nodeType = name;
    this.props = {};

    var args = arguments;
    propSpec.forEach(function (spec, i) {
      if (spec.type && spec.type.match(/^Node/)) {
        var value = args[i] || Empty;
        if (spec.valueConverter) {
          value = (spec.valueConverter.bind(self))(value) || Empty;
        }
      } else {
        value = args[i];
      }

      self.props[spec.name] = value;
    });
  }
  util.inherits(Subclass, this.ASTNode);

  var propDefs = {};
  propSpec.forEach(function (spec, i) {
    var propName = spec.name;
    propDefs[propName] = {
      get: function () {
        return this.props[propName];
      },
      set: function (value) {
        this.props[propName] = value;
      }
    };
  });
  Object.defineProperties(Subclass.prototype, propDefs);

  Subclass.prototype.transformChildren = function (transformer) {
    var self = this;
    var constructorArgs = [ ];

    propSpec.forEach(function (spec, i) {
      if (spec.type && spec.type.match(/^Node/)) {
        constructorArgs[i] = transformer(self.props[spec.name]);
        if (spec.transformCallback) {
          constructorArgs[i] = (spec.transformCallback)(constructorArgs[i]);
        }
      } else {
        constructorArgs[i] = self.props[spec.name];
      }
    });

    var result = construct(Subclass, constructorArgs);
    return result;
  };

  Subclass.prototype.equals = function (other) {
    var i, spec;
    for (i = 0; i < propSpec.length; i++) {
      spec = propSpec[i];
      if (spec.type && spec.type.match(/^Node/)) {
        if (!this.props[spec.name].equals(other[spec.name])) return false;
      } else {
        if (this.props[spec.name] !== other[spec.name]) return false;
      }
    }
    return true;
  };

  this[name] = Subclass;
};

ASTKit.prototype.ASTNode = ASTNode;
ASTKit.prototype.Empty = Empty;
ASTKit.prototype.List = List;

module.exports = ASTKit;
