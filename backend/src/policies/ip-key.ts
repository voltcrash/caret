import { Address6 } from "ip-address";
import { isIP } from "net";
export function getIpKey(ip: string): string {
  return isIP(ip) === 6
    ? `${new Address6(`${ip}/56`).startAddress().correctForm()}/56`
    : ip;
}
