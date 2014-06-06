
Elm.Native.Signal = {};
Elm.Native.Signal.make = function(elm) {

  elm.Native = elm.Native || {};
  elm.Native.Signal = elm.Native.Signal || {};
  if (elm.Native.Signal.values) return elm.Native.Signal.values;

  var Utils = Elm.Native.Utils.make(elm);
  var foldr1 = Elm.List.make(elm).foldr1;

  function send(node, timestep, isUpdate, isDuplicate) {
    var kids = node.kids;
    for (var i = kids.length; i--; ) {
      kids[i].recv(timestep, isUpdate, isDuplicate, node.id);
    }
  }

  function Input(base) {
    this.id = Utils.guid();
    this.value = base;
    this.kids = [];
    this.defaultNumberOfKids = 0;
    this.recv = function(timestep, updateId, v) {
      var isUpdate = updateId === this.id;
      var isDuplicate = !isUpdate || this.value === v;
      if (isUpdate) { this.value = v; }
      send(this, timestep, isUpdate, isDuplicate);
      return isUpdate;
    };
    elm.inputs.push(this);
  }

  function LiftN(pure, update, args) {
    this.id = Utils.guid();
    this.value = update();
    this.kids = [];

    var n = args.length;
    var count = 0;
    var anyUpdates = false;
    var allDuplicates = true;

    this.recv = function(timestep, isUpdate, isDuplicate, parentID) {
      ++count;
      if (isUpdate) { anyUpdates = true; }
      if (!isDuplicate) { allDuplicates = false; }
      if (count === n) {
        var resultIsDuplicate = pure && allDuplicates;
        if (!resultIsDuplicate) {
          var newValue = update();
          resultIsDuplicate = this.value === newValue;
          this.value = newValue;
        }
        send(this, timestep, anyUpdates, resultIsDuplicate);
        anyUpdates = false;
        allDuplicates = true;
        count = 0;
      }
    };
    for (var i = n; i--; ) { args[i].kids.push(this); }
  }

  function lift(func, a) {
    function update() { return func(a.value); }
    return new LiftN(true, update, [a]);
  }
  function lift2(func, a, b) {
    function update() { return A2( func, a.value, b.value ); }
    return new LiftN(true, update, [a,b]);
  }
  function lift3(func, a, b, c) {
    function update() { return A3( func, a.value, b.value, c.value ); }
    return new LiftN(true, update, [a,b,c]);
  }
  function lift4(func, a, b, c, d) {
    function update() { return A4( func, a.value, b.value, c.value, d.value ); }
    return new LiftN(true, update, [a,b,c,d]);
  }
  function lift5(func, a, b, c, d, e) {
    function update() { return A5( func, a.value, b.value, c.value, d.value, e.value ); }
    return new LiftN(true, update, [a,b,c,d,e]);
  }
  function lift6(func, a, b, c, d, e, f) {
    function update() { return A6( func, a.value, b.value, c.value, d.value, e.value, f.value ); }
    return new LiftN(true, update, [a,b,c,d,e,f]);
  }
  function lift7(func, a, b, c, d, e, f, g) {
    function update() { return A7( func, a.value, b.value, c.value, d.value, e.value, f.value, g.value ); }
    return new LiftN(true, update, [a,b,c,d,e,f,g]);
  }
  function lift8(func, a, b, c, d, e, f, g, h) {
    function update() { return A8( func, a.value, b.value, c.value, d.value, e.value, f.value, g.value, h.value ); }
    return new LiftN(true, update, [a,b,c,d,e,f,g,h]);
  }
  
  function liftEffect(func, a) {
    function update() { return func(a.value); }
    return new LiftN(false, update, [a]);
  }
  function liftEffect2(func, a, b) {
    function update() { return A2( func, a.value, b.value ); }
    return new LiftN(false, update, [a,b]);
  }

  function Foldp(step, state, input) {
    this.id = Utils.guid();
    this.value = state;
    this.kids = [];

    this.recv = function(timestep, isUpdate, _, parentID) {
      if (isUpdate) {
        var newValue = A2(step, input.value, this.value);
        var referenceEquality = this.value === newValue;
        this.value = newValue;
      }
      send(this, timestep, isUpdate, !isUpdate || referenceEquality);
    };
    input.kids.push(this);
  }

  function foldp(step, state, input) {
      return new Foldp(step, state, input);
  }

  function DropIf(pred, base, input) {
    this.id = Utils.guid();
    this.value = pred(input.value) ? base : input.value;
    this.kids = [];
    this.recv = function(timestep, isUpdate, isDuplicate, parentID) {
      var isChange = isUpdate && !pred(input.value);
      if (isChange) {
        var referenceEquality = this.value === input.value;
        this.value = input.value;
      }
      send(this, timestep, isChange, !isChange || referenceEquality);
    };
    input.kids.push(this);
  }

  function DropRepeats(input) {
    this.id = Utils.guid();
    this.value = input.value;
    this.kids = [];
    this.recv = function(timestep, isUpdate, isDuplicate, parentID) {
      var isChange = isUpdate && !Utils.eq(this.value,input.value);
      if (isChange) {
        this.value = input.value;
      }
      send(this, timestep, isChange, !isChange);
    };
    input.kids.push(this);
  }

  function timestamp(signal) {
    function update(value) { return Utils.Tuple2(Date.now(), value); }
    return liftEffect(update, signal);
  }

  function SampleOn(trigger, signal) {
    this.id = Utils.guid();
    this.value = s2.value;
    this.kids = [];

    var count = 0;
    var triggerIsUpdated = false;
    var signalIsDuplicate = false;

    this.recv = function(timestep, isUpdate, isDuplicate, parentID) {
      if (parentID === trigger.id) {
        triggerIsUpdated = isUpdate;
      }
      if (parentID === signal.id) {
        signalIsDuplicate = isDuplicate;
      }
      ++count;
      if (count === 2) {
        if (triggerIsUpdated) {
          this.value = signal.value;
        }
        send(this, timestep, triggerIsUpdated, signalIsDuplicate);
        count = 0;
        triggerIsUpdated = false;
        signalIsDuplicate = false;
      }
    };
    s1.kids.push(this);
    s2.kids.push(this);
  }

  function sampleOn(trigger, signal) {
    return new SampleOn(trigger, signal);
  }

  function delay(delayLength, signal) {
      var delayed = new Input(signal.value);
      var firstEvent = true;    
      function update(timestep, isUpdate, isDuplicate, parentID) {
        if (firstEvent) { firstEvent = false; return; }
        if (isUpdate) {
          var value = signal.value;
          setTimeout(function() {
              elm.notify(delayed.id, value);
          }, delayLength);
        }
      }
      function first(a,b) { return a; }
      return new SampleOn(delayed, lift2(F2(first), delayed, lift(update,s)));
  }

  function Merge(xs, ys) {
      this.id = Utils.guid();
      this.value = xs.value;
      this.kids = [];

      var next = null;
      var count = 0;
    
      this.recv = function(timestep, isUpdate, isDuplicate, parentID) {
        ++count;
        if (isUpdate) {
          if (parentID === xs.id) {
            next = xs;
          } else if (parentID === ys.id && next === null) {
            next = ys;
          }
        }

        if (count === 2) {
          var anyUpdates = next !== null;
          if (anyUpdates) {
            var referenceEquality = this.value === next.value;
            this.value = next.value;
          }
          send(this, timestep, anyUpdates, referenceEquality);
          count = 0;
          next = null;
        }
      };
      s1.kids.push(this);
      s2.kids.push(this);
  }

  function merge(xs, ys) {
      return new Merge(s1,s2);
  }
  function merges(signals) {
      return A2(foldr1, F2(merge), signals);
  }

  return elm.Native.Signal.values = {
    constant : function(v) { return new Input(v); },
    lift  : F2(lift ),
    lift2 : F3(lift2),
    lift3 : F4(lift3),
    lift4 : F5(lift4),
    lift5 : F6(lift5),
    lift6 : F7(lift6),
    lift7 : F8(lift7),
    lift8 : F9(lift8),
    liftEffect : liftEffect,
    liftEffect2 : liftEffect2,
    foldp : F3(foldp),
    delay : F2(delay),
    merge : F2(merge),
    merges : merges,
    count : function(s) { return foldp(F2(function(_,c) { return c+1; }), 0, s); },
    countIf : F2(function(pred,s) {
      return foldp(F2(function(x,c){
        return pred(x) ? c+1 : c; }), 0, s)}),
    keepIf : F3(function(pred,base,sig) {
      return new DropIf(function(x) {return !pred(x);},base,sig); }),
    dropIf : F3(function(pred,base,sig) { return new DropIf(pred,base,sig); }),
    dropRepeats : function(s) { return new DropRepeats(s);},
    sampleOn : F2(sampleOn),
    timestamp : timestamp
  };
};
