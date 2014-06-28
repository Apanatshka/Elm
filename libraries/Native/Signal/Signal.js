
Elm.Native.Signal = {};
Elm.Native.Signal.make = function(elm) {

  elm.Native = elm.Native || {};
  elm.Native.Signal = elm.Native.Signal || {};
  if (elm.Native.Signal.values) return elm.Native.Signal.values;

  var Utils = Elm.Native.Utils.make(elm);
  var foldr1 = Elm.List.make(elm).foldr1;

  function send(node, timestep, changed) {
    var kids = node.kids;
    for (var i = kids.length; i--; ) {
      kids[i].recv(timestep, changed, node.id);
    }
  }

  function Input(base) {
    this.id = Utils.guid();
    this.value = base;
    this.kids = [];
    this.defaultNumberOfKids = 0;
    this.recv = function(timestep, eid, v) {
      var changed = eid === this.id;
      if (changed) { this.value = v; }
      send(this, timestep, changed);
      return changed;
    };
    elm.inputs.push(this);
  }
  
  function PrimitiveNode(input1, input2, init, step) {
    this.id = Utils.guid();
    this.value = A2(step, input1.value, input2.value);
    this.kids = [];
    
    var msg1 = null;
    var msg2 = null;
    var result = null;
    
    this.recv = function(timestep, changed, parentID) {
      if(parentID === input1.id) {
        msg1 = { ctor: changed ? "Update" : "NoUpdate", _0: input1.value };
      } else {
        msg2 = { ctor: changed ? "Update" : "NoUpdate", _0: input2.value };
      }
      if(msg1 !== null && msg2 !== null) {
        result = A3(step, msg1, msg2, this.value);
        
        this.value = result._0;
        changed = result.ctor === "Update";
        send(this, timestep, changed);
        
        msg1 = null;
        msg2 = null;
      }
    }
    
    input1.kids.push(this);
    input2.kids.push(this);
  }
  
  function primitiveNode(i1, i2, init, step) {
    return new PrimitiveNode(i1, i2, init, step);
  }

  function timestamp(a) {
    function update() { return Utils.Tuple2(Date.now(), a.value); }
    return new LiftN(update, [a]);
  }

  function delay(t,s) {
      var delayed = new Input(s.value);
      var firstEvent = true;
      function update(v) {
        if (firstEvent) { firstEvent = false; return; }
        setTimeout(function() { elm.notify(delayed.id, v); }, t);
      }
      lift(update,s);
      return delayed;
  }

  return elm.Native.Signal.values = {
    constant : function(v) { return new Input(v); },
    primitiveNode : F4(primitiveNode),
    delay : F2(delay),
    timestamp : timestamp
  };
};
