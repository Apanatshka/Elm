module Signal where
{-| The library for general signal manipulation. Includes lift functions up to
`lift8` and infix lift operators `<~` and `~`, combinations, filters, and
past-dependence.

Signals are time-varying values. Lifted functions are reevaluated whenever any of
their input signals has an event. Signal events may be of the same value as the
previous value of the signal. Such signals are useful for timing and
past-dependence.

Some useful functions for working with time (e.g. setting FPS) and combining
signals and time (e.g.  delaying updates, getting timestamps) can be found in
the `Time` library.

# Combine
@docs constant, lift, lift2, merge, merges, combine

# Past-Dependence
@docs foldp, count, countIf

#Filters
@docs keepIf, dropIf, keepWhen, dropWhen, dropRepeats, sampleOn

# Pretty Lift
@docs (<~), (~)

# Do you even lift?
@docs lift3, lift4, lift5, lift6, lift7, lift8

-}

import Native.Signal
import List (foldr, foldr1, (::))
import Basics (not, (<|), always, (+), (.), id, (==))

data Signal a = Signal

data Event a = Update a | NoUpdate a

value e = case e of
            Update   v -> v
            NoUpdate v -> v

{-| Create a constant signal that never changes. -}
constant : a -> Signal a
constant = Native.Signal.constant

{-| Transform a signal with a given function. -}
lift  : (a -> b) -> Signal a -> Signal b
lift f sa = lift2 (always f) (constant ()) sa

{-| Combine two signals with a given function. -}
lift2 : (a -> b -> c) -> Signal a -> Signal b -> Signal c
lift2 f sa sb = Native.Signal.primitiveNode sa sb f <| \ea eb old ->
                  case (ea, eb) of
                    (Update a, _) -> Update <| f a (value eb)
                    (_, Update b) -> Update <| f (value ea) b
                    _             -> NoUpdate old

lift3 : (a -> b -> c -> d) -> Signal a -> Signal b -> Signal c -> Signal d
lift3 f i1 i2 i3                = f <~ i1 ~ i2 ~ i3

lift4 : (a -> b -> c -> d -> e) -> Signal a -> Signal b -> Signal c -> Signal d -> Signal e
lift4 f i1 i2 i3 i4             = f <~ i1 ~ i2 ~ i3 ~ i4

lift5 : (a -> b -> c -> d -> e -> f) -> Signal a -> Signal b -> Signal c -> Signal d -> Signal e -> Signal f
lift5 f i1 i2 i3 i4 i5          = f <~ i1 ~ i2 ~ i3 ~ i4 ~ i5

lift6 : (a -> b -> c -> d -> e -> f -> g)
      -> Signal a -> Signal b -> Signal c -> Signal d -> Signal e -> Signal f -> Signal g
lift6 f i1 i2 i3 i4 i5 i6       = f <~ i1 ~ i2 ~ i3 ~ i4 ~ i5 ~ i6

lift7 : (a -> b -> c -> d -> e -> f -> g -> h)
      -> Signal a -> Signal b -> Signal c -> Signal d -> Signal e -> Signal f -> Signal g -> Signal h
lift7 f i1 i2 i3 i4 i5 i6 i7    = f <~ i1 ~ i2 ~ i3 ~ i4 ~ i5 ~ i6 ~ i7

lift8 : (a -> b -> c -> d -> e -> f -> g -> h -> i)
      -> Signal a -> Signal b -> Signal c -> Signal d -> Signal e -> Signal f -> Signal g -> Signal h -> Signal i
lift8 f i1 i2 i3 i4 i5 i6 i7 i8 = f <~ i1 ~ i2 ~ i3 ~ i4 ~ i5 ~ i6 ~ i7 ~ i8


{-| Create a past-dependent signal. Each value given on the input signal will
be accumulated, producing a new output value.

For instance, `foldp (+) 0 (fps 40)` is the time the program has been running,
updated 40 times a second. -}
foldp : (a -> b -> b) -> b -> Signal a -> Signal b
foldp step base input = 
  Native.Signal.primitiveNode (constant ()) input (\_ _ -> base) <| \_ e state ->
    case e of
      Update   v -> Update (step v state)
      NoUpdate _ -> NoUpdate state

{-| Merge two signals into one, biased towards the first signal if both signals
update at the same time. -}
merge : Signal a -> Signal a -> Signal a
merge sl sr = Native.Signal.primitiveNode sl sr (\l _ -> l) <| \el er old ->
                case (el, er) of
                  (Update l, _) -> el
                  (_, Update r) -> er
                  _             -> NoUpdate old

{-| Merge many signals into one, biased towards the left-most signal if multiple
signals update simultaneously. -}
merges : [Signal a] -> Signal a
merges = foldr1 merge

{-| Combine a list of signals into a signal of lists. -}
combine : [Signal a] -> Signal [a]
combine = foldr (lift2 (::)) (Native.Signal.constant [])

 -- Merge two signals into one, but distinguishing the values by marking the first
 -- signal as `Left` and the second signal as `Right`. This allows you to easily
 -- fold over non-homogeneous inputs.
 -- mergeEither : Signal a -> Signal b -> Signal (Either a b)

{-| Count the number of events that have occurred. -}
count : Signal a -> Signal Int
count = foldp (\_ c -> c+1) 0

{-| Count the number of events that have occurred that satisfy a given predicate.
-}
countIf : (a -> Bool) -> Signal a -> Signal Int
countIf pred = foldp (\i c -> if pred i then c+1 else c) 0

{-| Keep only events that satisfy the given predicate. Elm does not allow
undefined signals, so a base case must be provided in case the predicate is
not satisfied initially. -}
keepIf : (a -> Bool) -> a -> Signal a -> Signal a
keepIf pred b s = keepWhen (pred <~ s) b s

{-| Drop events that satisfy the given predicate. Elm does not allow undefined
signals, so a base case must be provided in case the predicate is satisfied
initially. -}
dropIf : (a -> Bool) -> a -> Signal a -> Signal a
dropIf pred b s = keepWhen (not . pred <~ s) b s

{-| Keep events only when the first signal is true. Elm does not allow undefined
signals, so a base case must be provided in case the first signal is not true
initially.
-}
keepWhen : Signal Bool -> a -> Signal a -> Signal a
keepWhen latch b signal = 
  Native.Signal.primitiveNode latch signal (\l s -> if l then s else b) <| \el es old ->
    if value el then es else NoUpdate old

{-| Drop events when the first signal is true. Elm does not allow undefined
signals, so a base case must be provided in case the first signal is true
initially.
-}
dropWhen : Signal Bool -> a -> Signal a -> Signal a
dropWhen bs = keepWhen (not <~ bs)

{-| Drop updates that repeat the current value of the signal.

Imagine a signal `numbers` has initial value
0 and then updates with values 0, 0, 1, 1, and 2. `dropRepeats numbers`
is a signal that has initial value 0 and updates as follows: ignore 0,
ignore 0, update to 1, ignore 1, update to 2. -}
dropRepeats : Signal a -> Signal a
dropRepeats s = 
  Native.Signal.primitiveNode (constant ()) s (always id) <| \es _ old ->
    case es of
      Update   v -> if v == old then NoUpdate old else es
      NoUpdate _ -> NoUpdate old

{-| Sample from the second input every time an event occurs on the first input.
For example, `(sampleOn clicks (every second))` will give the approximate time
of the latest click. -}
sampleOn : Signal a -> Signal b -> Signal b
sampleOn trigger signal = 
  Native.Signal.primitiveNode trigger signal (always id) <| \t s old ->
    case t of
      Update   _ -> Update (value s)
      NoUpdate _ -> NoUpdate old

{-| An alias for `lift`. A prettier way to apply a function to the current value
of a signal. -}
(<~) : (a -> b) -> Signal a -> Signal b
f <~ s = lift f s

{-| Informally, an alias for `liftN`. Intersperse it between additional signal
arguments of the lifted function.

Formally, signal application. This takes two signals, holding a function and
a value. It applies the current function to the current value.

The following expressions are equivalent:

         scene <~ Window.dimensions ~ Mouse.position
         lift2 scene Window.dimensions Mouse.position
-}
(~) : Signal (a -> b) -> Signal a -> Signal b
sf ~ s = lift2 (<|) sf s

infixl 4 <~
infixl 4 ~
