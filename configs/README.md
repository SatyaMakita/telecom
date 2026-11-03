# Configuration templates

Use the official Open5GS and UERANSIM examples that match the exact software versions installed. This directory intentionally does not overwrite system configuration files.

Before launching a simulated UE:
1. Choose a private test PLMN for the isolated lab.
2. Make MCC/MNC consistent across AMF, gNB and UE.
3. Match TAC and slice settings.
4. Create a synthetic subscriber in Open5GS.
5. Ensure the synthetic UE's SUPI, K, OPc and AMF authentication parameter match the database entry.
6. Keep interfaces on loopback for a same-host setup.
7. Validate each configuration against the upstream version's example and schema.

Never use real SIM credentials or connect the simulator to a commercial network.
