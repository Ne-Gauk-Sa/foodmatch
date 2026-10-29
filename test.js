const {meets,winner}=require('./logic');const a=require('assert');
const M={mode:'majority'},T={mode:'twoThirds'},U={mode:'unanimous'},C=p=>({mode:'custom',pct:p});
a(!meets(2,4,M));a(meets(3,4,M));a(meets(2,3,M));a(!meets(1,2,M));a(meets(3,5,M));a(!meets(1,3,M));
a(meets(2,3,T));a(!meets(1,3,T));a(meets(4,6,T));a(!meets(3,6,T));a(!meets(2,4,T));a(meets(3,4,T));a(!meets(3,5,T));a(meets(4,5,T));
a(meets(4,4,U));a(!meets(3,4,U));a(meets(1,1,U));
a(meets(2,4,C(50)));a(!meets(1,4,C(50)));a(meets(3,4,C(75)));a(!meets(2,4,C(75)));a(meets(1,4,C(25)));a(!meets(3,4,C(80)));a(meets(4,4,C(100)));a(!meets(3,4,C(100)));a(meets(2,3,C(66.7))===false);a(meets(2,3,C(66)));
a(!meets(0,0,M));
const mem=['a','b','c','d'];const v={a:{x:true,y:true,z:true},b:{x:true,y:true,z:true},c:{x:true,y:true,z:false},d:{y:true,z:true}};
let w=winner(['x','y','z'],mem,v,M);a.equal(w.id,'y'); // y 4/4
w=winner(['x','z'],mem,v,M);a.equal(w.id,'x'); // x 3/4, z 3/4 tie -> first
a.equal(winner(['x','z'],mem,v,U),null);
a.equal(winner(['x','z'],mem,{a:{x:true},b:{x:true}},M),null); // 2/4 not majority
a.equal(winner(['x','z'],mem,{a:{x:true},b:{x:true}},C(50)).id,'x');
console.log('all tests passed');
