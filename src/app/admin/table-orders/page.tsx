import { CounterPOS } from "@/components/admin/counter-pos";
export default async function Page({searchParams}:{searchParams:Promise<{session?:string}>}){const p=await searchParams;return <CounterPOS mode="TABLE" sessionId={p.session??''}/>}
