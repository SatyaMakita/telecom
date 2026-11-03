import React, { useState } from 'react';
import { BookOpen, Network, FileCode, CheckCircle2, Save, Terminal } from 'lucide-react';

const protocols = [
  {
    name: 'NGAP (Next Generation Application Protocol)',
    gen: '5G SA',
    layer: 'Control Plane (N2)',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    description:
      'Transports control-plane signalling between gNB and AMF over SCTP port 38412. Handles NG setup, UE initial registration context, PDU session establishment, and handovers.',
    samplePayload: `NGAP-PDU: initiatingMessage
  procedureCode: 14 (id-InitialUEMessage)
  criticality: 0 (reject)
  value: InitialUEMessage
    protocolIEs:
      - id-RAN-UE-NGAP-ID: 1
      - id-NAS-PDU: 7e 00 41 79 00 ... (5GS Registration)`,
  },
  {
    name: 'HTTP/2 SBI (Service-Based Architecture)',
    gen: '5G Core',
    layer: 'Control Plane (Core SBI)',
    badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    description:
      'Standardized REST APIs with JSON serialization over HTTP/2 with TLS. NFs like AMF, SMF, UDM, and AUSF communicate across interfaces (Namf, Nsmf, Nudm, Nausf).',
    samplePayload: `POST /nausf-auth/v1/ue-authentications HTTP/2
Host: 127.0.0.6:7777
Content-Type: application/json

{
  "supiOrSuci": "imsi-999700000000001",
  "servingNetworkName": "5G:mnc070.mcc999.3gppnetwork.org"
}`,
  },
  {
    name: 'GTP-U (GPRS Tunnelling Protocol User Plane)',
    gen: '3G / 4G / 5G',
    layer: 'User Plane (N3/S1-U)',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    description:
      'Encapsulates user IP packets across the radio access network and packet core over UDP port 2152. Key fields include TEID (Tunnel Endpoint Identifier) assigned per PDU session.',
    samplePayload: `UDP: Source port 2152, Destination port 2152
GTPv1-U:
  Flags: 0x30 (Version 1, Protocol Type GTP)
  Message Type: 255 (G-PDU)
  Length: 84 bytes
  TEID: 0x00000001
[Encapsulated IP Packet: 10.45.0.2 -> 8.8.8.8]`,
  },
  {
    name: 'NAS (Non-Access Stratum)',
    gen: '4G LTE / 5G NR',
    layer: 'Control Plane (UE <-> Core)',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    description:
      'Signalling messages directly between the mobile handset (UE) and the core network (AMF/MME). Transparently passed through the radio base station (gNB/eNB).',
    samplePayload: `5GS Mobility Management (5GMM):
  Security header type: Plain NAS message
  Message type: Registration request (0x41)
  5GS registration type: Initial registration
  5GS mobile identity: SUCI (or 5G-GUTI)`,
  },
  {
    name: 'Diameter',
    gen: '4G LTE',
    layer: 'Core Signaling (S6a, Gx, Gy)',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    description:
      'AAA (Authentication, Authorization, Accounting) protocol used heavily in EPC between MME and HSS, and between PGW and PCRF over SCTP or TCP port 3868.',
    samplePayload: `Diameter Protocol:
  Version: 1, Length: 284 bytes
  Command Code: 316 (Authentication-Information-Request)
  ApplicationId: 16777251 (3GPP S6a)
  User-Name AVP: 999700000000001`,
  },
  {
    name: 'SS7 / MAP (Mobile Application Part)',
    gen: '2G / 3G Legacy',
    layer: 'Circuit & Packet Core Signaling',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    description:
      'Classical telecom signalling network protocol family over TDM or SIGTRAN. Replaced by Diameter in 4G and HTTP/2 in 5G.',
    samplePayload: `MAP Message:
  invoke:
    operationCode: localValue (updateLocation)
    parameter:
      imsi: 999700000000001
      vlr-Number: 9997000000`,
  },
];

export default function Protocols() {
  const [activeProto, setActiveProto] = useState(protocols[0]);
  const [labNotes, setLabNotes] = useState(
    'Lab Observation Note: In 5G Standalone, all SBI interfaces use HTTP/2 with JSON payloads, making Wireshark analysis simple with TLS decryption or plaintext loopback captures.'
  );
  const [saved, setSaved] = useState(false);

  const handleSaveNotes = () => {
    localStorage.setItem('telecom_lab_notes', labNotes);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-400" />
            Protocol Family Architecture & Signalling
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Key protocols across 2G, 3G, 4G, and 5G network generations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Protocol List */}
        <div className="space-y-3">
          {protocols.map((p) => (
            <button
              key={p.name}
              onClick={() => setActiveProto(p)}
              className={`w-full text-left p-4 rounded-xl border transition ${
                activeProto.name === p.name
                  ? 'bg-slate-800 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                  : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.badgeColor}`}>
                  {p.gen}
                </span>
                <span className="text-[11px] text-slate-400">{p.layer}</span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1">{p.name}</h4>
              <p className="text-xs text-slate-400 line-clamp-2">{p.description}</p>
            </button>
          ))}
        </div>

        {/* Selected Protocol Details */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg lg:col-span-2 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${activeProto.badgeColor}`}>
                  {activeProto.gen}
                </span>
                <span className="text-xs text-slate-400 font-mono">{activeProto.layer}</span>
              </div>
              <h3 className="text-lg font-bold text-white">{activeProto.name}</h3>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">{activeProto.description}</p>

          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-blue-400" />
              Example Packet Structure (Synthetic Lab Capture)
            </h4>
            <pre className="bg-slate-900 border border-slate-700/80 rounded-lg p-4 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre">
              {activeProto.samplePayload}
            </pre>
          </div>

          {/* Practical wireshark tip */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-200">
            <span className="font-semibold text-blue-300">Wireshark Filter Tip: </span>
            {activeProto.name.startsWith('NGAP')
              ? 'Filter by `ngap` to inspect 5G RAN signalling. Filter by `sctp.port == 38412`.'
              : activeProto.name.startsWith('HTTP/2')
              ? 'Filter by `http2` to inspect 5G Core REST operations between microservices.'
              : activeProto.name.startsWith('GTP')
              ? 'Filter by `gtp` or `udp.port == 2152` to inspect encapsulated subscriber data packets.'
              : activeProto.name.startsWith('NAS')
              ? 'Filter by `nas_5gs` or `nas-eps`.'
              : 'Filter by `diameter` or `sctp`.'}
          </div>

          {/* Student / Lab Notes */}
          <div className="pt-2 border-t border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-300">Lab Notes & Analysis Log</h4>
              <button
                onClick={handleSaveNotes}
                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1 rounded flex items-center gap-1.5 transition"
              >
                {saved ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                {saved ? 'Saved!' : 'Save Notes'}
              </button>
            </div>
            <textarea
              value={labNotes}
              onChange={(e) => setLabNotes(e.target.value)}
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              placeholder="Record your observation or Wireshark packet findings..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
