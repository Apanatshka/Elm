
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
  
  var NoUpdate$ = { ctor: "NoUpdate'" };
  
  // primitiveNode : (a_n -> b) -> ((Event a)_n -> b -> Event b) -> (Signal a)_n -> Signal b
  function PrimitiveNode(init, step, inputs) {
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
        
        this.value = result === NoUpdate$ ? this.value : result._0;
        changed = result.ctor === "Update";
        send(this, timestep, changed);
        
        msgs = new Array(n);
        count = 0;
      }
    }
    
    for (var i = n; i--; ) { inputs[i].kids.push(this); }
  }
  
  function primitiveNode1(init, step, i1) {
    return new PrimitiveNode(init, step, [i1]);
  }
  
  function primitiveNode2(init, step, i1, i2) {
    return new PrimitiveNode(init, step, [i1, i2]);
  }
  
  // primitiveState : (a_n -> (b,s)) -> ((Event a)_n -> s -> b -> (Event b,s)) -> (Signal a)_n -> Signal b
  function PrimitiveState(init, step, inputs) {
    this.id = Utils.guid();
    
    var result = AN(init, inputs.map(function(input,i,a){return input.value;}));
    this.value = result._0; // unpack tuple
    this.state = result._1;
    
    this.kids = [];
    
    var n = inputs.length;
    var count = 0;
    var msgs = new Array(n);
    
    this.recv = function(timestep, changed, parentID) {
      for (var i = inputs.length; i--; ) {
        if(inputs[i].id === parentID) {
          msgs[i] = { ctor: changed ? "Update" : "NoUpdate", _0: inputs[i].value };
          count++;
          break;
        }
      }
      if(count === n) {
        result = AN(step, msgs.concat(this.state, this.value));
        
        this.value = result._0 === NoUpdate$ ? this.value : result._0._0; // unpack the Update value in the tuple
        this.state = result._1;
        changed = result._0.ctor === "Update";
        send(this, timestep, changed);
        
        msgs = new Array(n);
        count = 0;
      }
    }
    
    for (var i = n; i--; ) { inputs[i].kids.push(this); }
  }
  
  function primitiveState(init, step, i1) {
    return new PrimitiveState(init, step, [i1]);
  }

  function timestamp(a) {
    function init(v) { return Utils.Tuple2(Date.now(), v); }
    function step(v) {
      switch(v.ctor) {
        case "Update":
          return { ctor: "Update", _0: init(v._0) };
        case "NoUpdate":
          return v;
      }
    }
    return primitiveNode1(init, step, a);
  }

  function delay(t,s) {
      var delayed = new Input(s.value);
      function update(v) {
        setTimeout(function() { elm.notify(delayed.id, v); }, t);
      }
      s.kids.push({
        id : Utils.guid(),
        recv : function(timestep, changed, parentID) {
          if(changed) {
            update(s.value);
          }
        }
      });
      return delayed;
  }

  return elm.Native.Signal.values = {
    constant : function(v) { return new Input(v); },
    primitiveNode1 : F3(primitiveNode1),
    primitiveNode2 : F4(primitiveNode2),
    primitiveState : F3(primitiveState),
    NoUpdate$ : NoUpdate$,
    delay : F2(delay),
    timestamp : timestamp
  };
};
