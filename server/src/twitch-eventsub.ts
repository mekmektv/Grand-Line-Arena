// GRAND LINE ARENA — Brique 6 : vérification de signature des notifications EventSub (webhook).
//
// Doc Twitch : la signature attendue est HMAC-SHA256("sha256=" + hex) de la CONCATÉNATION
// message-id + timestamp + corps BRUT (avant tout JSON.parse), avec le secret partagé au moment
// de la création de l'abonnement (TWITCH_EVENTSUB_SECRET). Sans ça, le webhook est une URL
// publique que n'importe qui pourrait appeler pour se faire créditer un coffre premium.

import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifierSignatureEventsub(params: {
  secret: string;
  messageId: string;
  timestamp: string;
  corpsBrut: string;
  signatureRecue: string;
}): boolean {
  const { secret, messageId, timestamp, corpsBrut, signatureRecue } = params;
  const attendue = 'sha256=' + createHmac('sha256', secret)
    .update(messageId + timestamp + corpsBrut)
    .digest('hex');

  const a = Buffer.from(signatureRecue);
  const b = Buffer.from(attendue);
  return a.length === b.length && timingSafeEqual(a, b);
}
