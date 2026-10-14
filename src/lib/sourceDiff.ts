export function diffLines(before:string,after:string):{kind:'same'|'add'|'remove';text:string}[]{
 const a=before.split('\n'),b=after.split('\n');
 if(a.length*b.length>600000)return [...a.map(text=>({kind:'remove' as const,text})),...b.map(text=>({kind:'add' as const,text}))];
 const table=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)table[i][j]=a[i]===b[j]?table[i+1][j+1]+1:Math.max(table[i+1][j],table[i][j+1]);
 const rows:ReturnType<typeof diffLines>=[];let i=0,j=0;while(i<a.length||j<b.length){if(i<a.length&&j<b.length&&a[i]===b[j]){rows.push({kind:'same',text:a[i]});i++;j++;}else if(j<b.length&&(i===a.length||table[i][j+1]>=table[i+1][j]))rows.push({kind:'add',text:b[j++]});else rows.push({kind:'remove',text:a[i++]});}return rows;
}
