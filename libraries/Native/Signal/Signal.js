
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
  
  function PrimitiveNode(inputs, init, step) {
    this.id = Utils.guid();
    this.value = AN(init, inputs.map(function(input,i,a){return input.value;}));
    this.kids = [];
    
    var n = inputs.length;
    var count = 0;
    var msgs = new Array(n);
    var result;
    
    this.recv = function(timestep, changed, parentID) {
      for (var i = inputs.length; i--; ) {
        if(inputs[i].id === parentID) {
          msgs[i] = { ctor: changed ? "Update" : "NoUpdate", _0: inputs[i].value };
          count++;
          break;
        }
      }
      if(count === n) {
        result = AN(step, msgs.concat(this.value));
        
        this.value = result._0;
        changed = result.ctor === "Update";
        send(this, timestep, changed);
        
        msgs = new Array(n);
        count = 0;
      }
    }
    
    for (var i = n; i--; ) { inputs[i].kids.push(this); }
  }
  
  function primitiveNode1(i1, init, step) {
    return new PrimitiveNode([i1], init, step);
  }
  
  function primitiveNode2(i1, i2, init, step) {
    return new PrimitiveNode([i1, i2], init, step);
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
    primitiveNode1 : F3(primitiveNode1),
    primitiveNode2 : F4(primitiveNode2),
    delay : F2(delay),
    timestamp : timestamp
  };
};
