/* Shared browser/Node puzzle engine. Every generated grid is a spanning tree. */
(function(root){
  const directions=[[-1,0],[0,1],[1,0],[0,-1]];
  function rotate(mask){return ((mask<<1)&15)|(mask>>3);}
  function powered(tiles,n){const seen=new Set([0]),queue=[0];for(let k=0;k<queue.length;k++){const i=queue[k],r=Math.floor(i/n),c=i%n;directions.forEach(([dr,dc],d)=>{const nr=r+dr,nc=c+dc,j=nr*n+nc;if(nr>=0&&nr<n&&nc>=0&&nc<n&&(tiles[i]&(1<<d))&&(tiles[j]&(1<<((d+2)%4)))&&!seen.has(j)){seen.add(j);queue.push(j);}});}return seen;}
  function generate(n,random=Math.random){const solution=Array(n*n).fill(0),seen=new Set([0]),stack=[0];while(stack.length){const i=stack[stack.length-1],r=Math.floor(i/n),c=i%n;const options=directions.map(([dr,dc],d)=>({r:r+dr,c:c+dc,d})).filter(p=>p.r>=0&&p.r<n&&p.c>=0&&p.c<n&&!seen.has(p.r*n+p.c));if(!options.length){stack.pop();continue;}const p=options[Math.floor(random()*options.length)],j=p.r*n+p.c;solution[i]|=1<<p.d;solution[j]|=1<<((p.d+2)%4);seen.add(j);stack.push(j);}const tiles=solution.map(m=>{for(let k=Math.floor(random()*4);k>0;k--)m=rotate(m);return m;});if(powered(tiles,n).size===n*n)tiles[0]=rotate(tiles[0]);return {solution,tiles};}
  const api={rotate,powered,generate};if(typeof module!=='undefined')module.exports=api;else root.GridEngine=api;
})(globalThis);
