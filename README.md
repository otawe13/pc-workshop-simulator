# PC WORKSHOP SIMULATOR — ULTIMATE BUSINESS EDITION

**Build. Repair. Upgrade. Manage. Compete.**

A complete browser-based 3D PC Building, Computer Repair, and Business Management Simulator built with HTML5, CSS3, TypeScript/ES Modules, Three.js, React, and optional Supabase cloud rankings.

## Features

- **3D Interactive Workshop (`Three.js`)**: 14 modeled workshop stations (Entrance, Reception, Waiting Area, Assembly Workbench, Repair Table, Component Shelves, Inventory Cabinet, Testing Station, Business Computer, Tool Storage, Packaging Area, Component Display, Lighting, Signage) with smooth exponential camera transitions and interactive raycasting.
- **11-Stage Interactive PC Assembly**: Side panel removal, motherboard standoffs, CPU socket retention, thermal paste, air/liquid coolers, dual-channel RAM, M.2 NVMe & SATA storage, GPU clearance, PSU & cabling, case headers, and first boot.
- **Real Compatibility & Power Engine**: Validates CPU sockets, chipsets, BIOS versions, DDR3/DDR4/DDR5 generations, M.2/SATA limits, GPU length & cooler height clearances, and PSU wattage + PCIe connectors.
- **POST, Interactive UEFI BIOS & OS Installation**: Real POST checks & beep codes, 9-section BIOS with boot priority & live thermals, Bootable USB OS Installer (`Windows 10`, `Windows 11`, `Linux Mint`, `Ubuntu`) with EFI/System/Data partition manager, Driver Manager, and Hardware Benchmarks.
- **Diagnostics & Repair**: 7 workshop diagnostic tools (`Screwdriver`, `PSU Tester`, `Multimeter`, `RAM Tester`, `IR Thermal Probe`, `Diagnostic USB`, `Recovery Media`) to uncover 14 hardware & software faults.
- **Business Economy & Leaderboards**: Indonesian Rupiah (`Rp`) ledger, suppliers & deliveries, workshop upgrades that visibly upgrade the 3D shop, reputation & 5 business levels, Local Leaderboard, and optional Supabase Global Online Leaderboard.

## Running Locally in Chrome

1. Install dependencies:
   ```bash
   npm install
   ```
2. Launch the development server:
   ```bash
   npm run dev
   ```
3. Open Google Chrome on Windows or Android and navigate to `http://localhost:3000`.

## Saving Progress

- Progress automatically saves to browser `localStorage` (`autosave`) and supports 3 manual save slots (`slot_1`, `slot_2`, `slot_3`) with corrupted-save recovery.

## Enabling the Global Online Leaderboard

See `backend/setup-guide.md` and `backend/supabase-schema.sql`.
