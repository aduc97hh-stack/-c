import {createClient} from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Set Supabase URL and server-only service role in secure runner environment.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const result=await db.rpc('run_scheduled_operations');
if(result.error){console.error(JSON.stringify({event:'operations_failed',code:result.error.code??'unknown',time:new Date().toISOString()}));process.exitCode=1;}
else console.info(JSON.stringify({event:'operations_completed',counts:result.data,time:new Date().toISOString()}));
