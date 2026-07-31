import { Inbox } from "lucide-react";
export function Empty({ message = "No records found." }:
    { message?: string }) {
    return <div className="empty">

        <Inbox size={28} style={{ margin: "0 auto 10px" }} /><div>{message}</div></div>;
}


