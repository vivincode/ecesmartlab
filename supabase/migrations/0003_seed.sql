-- ==============================================================================
-- SmartLab Component Lending & Management Platform
-- Migration 0003: Institutional Reference Data & Component Inventory Seed
-- Note: User accounts are created securely via Supabase Auth (/register or Admin).
-- ==============================================================================

INSERT INTO institutions (id, name, code, domain, address)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Institute of Engineering & Applied Sciences',
  'IEAS-TECH',
  'college.edu',
  'Innovation Block, Main Campus'
) ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (name, display_name, description, permissions) VALUES
  ('student', 'Student', 'Browse catalog, submit borrow requests, book lab slots, manage project teams, report defects.', '{"catalog:read":true,"borrow:create":true,"booking:create":true,"team:manage":true}'::jsonb),
  ('staff', 'Laboratory Staff / Faculty', 'Manage assigned lab inventory, approve/reject requests & bookings, checkout/return inspection, maintenance.', '{"catalog:manage_lab":true,"borrow:review":true,"loan:checkout_return":true,"booking:review":true,"maintenance:manage":true,"reports:export":true}'::jsonb),
  ('admin', 'Administrator', 'Full institutional control: users, roles, departments, labs, policies, overrides, audit logs, exports.', '{"*":true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO institutional_settings (
  institution_id,
  max_borrow_qty_per_request,
  max_active_loans_per_student,
  max_loan_duration_days,
  overdue_grace_hours,
  staff_invite_code,
  enable_email_notifications,
  enable_deposits,
  enable_late_fees,
  late_fee_per_day,
  enable_replacement_charges
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  10, 5, 14, 24, 'STAFF-ACCESS-2026', FALSE, FALSE, FALSE, 0.00, FALSE
) ON CONFLICT (institution_id) DO NOTHING;

-- Departments
INSERT INTO departments (id, institution_id, name, code, description, head_name) VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', 'Electronics & Communication Engineering', 'ECE', 'Analog, digital, RF, and embedded hardware engineering.', 'Dr. R. Subramanian'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', 'Robotics & Automation Engineering', 'RAE', 'Autonomous mobility, actuators, perception, and control systems.', 'Dr. K. Meenakshi'),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111111', 'Computer Science & IoT Systems', 'CSE-IOT', 'Edge computing, wireless sensor networks, and smart hardware.', 'Prof. A. Deshmukh')
ON CONFLICT (code) DO NOTHING;

-- Laboratories
INSERT INTO laboratories (id, institution_id, department_id, name, code, building, room_number, description, capacity) VALUES
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', 'ECE Components Lab', 'ECE-101', 'Block A', 'A-101', 'Core passives, prototyping boards, multimeters, and discrete IC inventory.', 30),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', 'Embedded Systems Lab', 'ECE-204', 'Block A', 'A-204', 'Microcontrollers, SBCs, logic analyzers, and real-time firmware benches.', 24),
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', 'Communication & RF Lab', 'ECE-305', 'Block B', 'B-305', 'Oscilloscopes, RF signal generators, spectrum equipment, and soldering stations.', 20),
  ('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222202', 'Robotics & IoT Prototyping Studio', 'RAE-108', 'Innovation Center', 'IC-108', 'Brushless motors, LiDAR sensors, IMU modules, and autonomous dev kits.', 22)
ON CONFLICT (code) DO NOTHING;

-- Categories & Subcategories
INSERT INTO categories (id, parent_id, name, slug, description, icon) VALUES
  ('44444444-4444-4444-4444-444444444401', NULL, 'Microcontrollers & SBCs', 'microcontrollers-sbcs', 'Arduino, ESP32, STM32, and Raspberry Pi boards.', 'Cpu'),
  ('44444444-4444-4444-4444-444444444402', NULL, 'Sensors & Modules', 'sensors-modules', 'IMU, ultrasonic, environmental, LiDAR, and RF modules.', 'Radar'),
  ('44444444-4444-4444-4444-444444444403', NULL, 'Test & Measurement', 'test-measurement', 'Oscilloscopes, multimeters, logic analyzers, power supplies.', 'Activity'),
  ('44444444-4444-4444-4444-444444444404', NULL, 'Passives & Prototyping', 'passives-prototyping', 'Resistors, capacitors, inductors, breadboards, jumper wires.', 'CircuitBoard'),
  ('44444444-4444-4444-4444-444444444405', NULL, 'Actuators & Power', 'actuators-power', 'Servo motors, stepper drivers, relays, buck converters.', 'Zap'),
  ('44444444-4444-4444-4444-444444444406', NULL, 'Fabrication & Soldering', 'fabrication-soldering', 'Soldering stations, hot air rework, crimping tools.', 'Wrench')
ON CONFLICT (slug) DO NOTHING;

-- Components across laboratories
INSERT INTO components (
  id, department_id, laboratory_id, category_id, name, sku, description, usage_instructions,
  manufacturer, model, storage_location, specifications, is_serialized,
  total_quantity, available_quantity, reserved_quantity, borrowed_quantity, min_stock_threshold,
  condition, status, replacement_value, image_urls
) VALUES
  (
    '55555555-5555-5555-5555-555555555501',
    '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333301', '44444444-4444-4444-4444-444444444404',
    'Precision Resistor Assortment Kit (600 pcs)', 'CMP-RES-014',
    '1/4W 1% metal film resistor kit spanning 10 Ohm to 1 MOhm for analog and digital biasing.',
    'Verify resistance with multimeter before soldering. Return sorted tray compartments.',
    'Yageo', 'MFR-25FBF52', 'Rack A / Bin 04',
    '{"tolerance":"±1%","power_rating":"0.25W","values":"30 values x 20 pcs"}'::jsonb,
    FALSE, 30, 30, 0, 0, 5, 'Good', 'Available', 12.50,
    ARRAY['/images/components/resistor-assortment-kit.jpg']
  ),
  (
    '55555555-5555-5555-5555-555555555502',
    '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333301', '44444444-4444-4444-4444-444444444404',
    '830-Point Solderless Breadboard', 'CMP-BRD-008',
    'Full-size ABS solderless breadboard with dual power rails and phosphor bronze contacts.',
    'Do not insert wires thicker than 22 AWG to prevent spring clip deformation.',
    'BusBoard', 'BB830', 'Rack A / Bin 09',
    '{"tie_points":830,"wire_gauge":"22-29 AWG","voltage_max":"300V"}'::jsonb,
    FALSE, 25, 25, 0, 0, 4, 'Good', 'Available', 8.00,
    ARRAY['/images/components/breadboard-830.jpg']
  ),
  (
    '55555555-5555-5555-5555-555555555503',
    '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333301', '44444444-4444-4444-4444-444444444401',
    'Arduino Uno R3 Development Board', 'BRD-ARD-001',
    'ATmega328P 8-bit AVR microcontroller board with USB-B programming interface and 14 digital I/O.',
    'Use regulated 5V USB or 7-12V barrel jack. Never short 5V pin to GND.',
    'Arduino', 'A000066', 'Cabinet B / Drawer 01',
    '{"mcu":"ATmega328P","clock":"16 MHz","operating_voltage":"5V","digital_io":14}'::jsonb,
    FALSE, 20, 20, 0, 0, 4, 'Good', 'Available', 28.00,
    ARRAY['/images/components/arduino-uno-r3.jpg']
  ),
  (
    '55555555-5555-5555-5555-555555555504',
    '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333301', '44444444-4444-4444-4444-444444444403',
    'Fluke 115 True-RMS Digital Multimeter', 'INS-DMM-001',
    'Field-grade True-RMS digital multimeter with backlit display, AC/DC voltage, current, and resistance.',
    'Inspect test probes before use. Switch to current range only when measuring in series.',
    'Fluke', '115', 'Cabinet C / Slot 01-12',
    '{"counts":6000,"safety_rating":"CAT III 600V","accuracy_dc":"0.5%"}'::jsonb,
    TRUE, 12, 12, 0, 0, 2, 'Good', 'Available', 210.00,
    ARRAY['/images/components/fluke-115-dmm.jpg']
  ),
  (
    '55555555-5555-5555-5555-555555555505',
    '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333302', '44444444-4444-4444-4444-444444444401',
    'ESP32-S3 DevKitC-1 Dual-Core Wi-Fi/BLE', 'EMB-ESP-021',
    'Dual-core Xtensa LX7 microcontroller with Wi-Fi 802.11b/g/n, Bluetooth 5 LE, and 8MB PSRAM.',
    '3.3V logic only. Use level shifters when interfacing with 5V peripherals.',
    'Espressif', 'ESP32-S3-DevKitC-1', 'Rack E / Tray 02',
    '{"cpu":"Xtensa LX7 240MHz","connectivity":"Wi-Fi + BLE 5","logic_level":"3.3V"}'::jsonb,
    FALSE, 18, 18, 0, 0, 4, 'New', 'Available', 16.00,
    ARRAY['/images/components/esp32-s3-devkitc.jpg']
  ),
  (
    '55555555-5555-5555-5555-555555555506',
    '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333302', '44444444-4444-4444-4444-444444444401',
    'Raspberry Pi 5 (8GB RAM) Kit', 'EMB-RPI-009',
    'Quad-core Arm Cortex-A76 2.4GHz single-board computer with active cooler and 27W USB-C PSU.',
    'Always shut down cleanly via OS before cutting power to protect microSD storage.',
    'Raspberry Pi', 'SC1112', 'Secure Vault / Bay 03',
    '{"ram":"8GB LPDDR4X","soc":"BCM2712","pcie":"PCIe 2.0 x1"}'::jsonb,
    TRUE, 8, 8, 0, 0, 2, 'Good', 'Available', 95.00,
    ARRAY['/images/components/raspberry-pi-5-kit.jpg']
  ),
  (
    '55555555-5555-5555-5555-555555555507',
    '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333302', '44444444-4444-4444-4444-444444444403',
    'Saleae Logic Pro 8 USB Logic Analyzer', 'EMB-LOG-034',
    '8-channel digital & analog USB logic analyzer up to 500 MS/s for SPI, I2C, UART, CAN debugging.',
    'Connect ground clip first before attaching probe hooks to target PCB.',
    'Saleae', 'Logic Pro 8', 'Cabinet D / Drawer 02',
    '{"channels":8,"max_sample_rate":"500 MS/s","protocols":"SPI/I2C/UART/CAN"}'::jsonb,
    TRUE, 6, 6, 0, 0, 1, 'Good', 'Available', 499.00,
    ARRAY['/images/components/saleae-logic-pro-8.jpg']
  ),
  (
    '55555555-5555-5555-5555-555555555508',
    '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333303', '44444444-4444-4444-4444-444444444403',
    'Rigol DS1054Z 4-Channel 50MHz Oscilloscope', 'COM-OSC-006',
    '4-channel digital storage oscilloscope with 1 GSa/s sampling, 24 Mpts memory depth, and 4x 150MHz probes.',
    'Verify probe attenuation (1X/10X) matches channel configuration. Ground clip is earth-referenced.',
    'Rigol', 'DS1054Z', 'Bench Bay 01-06',
    '{"channels":4,"bandwidth":"50 MHz","sample_rate":"1 GSa/s"}'::jsonb,
    TRUE, 6, 6, 0, 0, 1, 'Good', 'Available', 420.00,
    ARRAY['/images/components/rigol-ds1054z.jpg']
  ),
  (
    '55555555-5555-5555-5555-555555555509',
    '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333303', '44444444-4444-4444-4444-444444444406',
    'Hakko FX-888D Digital Soldering Station', 'COM-SOL-011',
    '70W digital temperature-controlled soldering station with T18 chisel tip and brass sponge holder.',
    'Tin tip before powering off. Set temperature to 350°C for lead-free SAC305 solder.',
    'Hakko', 'FX888D-23BY', 'Rework Bench 01-08',
    '{"power":"70W","temp_range":"50-480 °C","esd_safe":true}'::jsonb,
    TRUE, 8, 8, 0, 0, 2, 'Good', 'Available', 135.00,
    ARRAY['/images/components/hakko-fx888d.jpg']
  ),
  (
    '55555555-5555-5555-5555-555555555510',
    '22222222-2222-2222-2222-222222222202', '33333333-3333-3333-3333-333333333304', '44444444-4444-4444-4444-444444444402',
    'RPLIDAR A1M8 360° 2D Laser Scanner', 'RAE-LID-004',
    '360-degree omnidirectional laser range scanner (12m range) with UART-to-USB adapter for SLAM.',
    'Do not obstruct rotating turret during spin-up. Operate via ROS 2 rplidar_ros driver.',
    'SLAMTEC', 'A1M8-R6', 'Robotics Vault / Shelf 02',
    '{"range":"0.15-12 m","scan_rate":"5.5 Hz","sample_freq":"8000 Hz"}'::jsonb,
    TRUE, 5, 5, 0, 0, 1, 'Good', 'Available', 120.00,
    ARRAY['/images/components/rplidar-a1m8.jpg']
  ),
  (
    '55555555-5555-5555-5555-555555555511',
    '22222222-2222-2222-2222-222222222202', '33333333-3333-3333-3333-333333333304', '44444444-4444-4444-4444-444444444405',
    'MG996R High-Torque Metal Gear Servo', 'RAE-SRV-019',
    '10 kg-cm stall torque metal gear servo motor (4.8V - 7.2V) for robotic manipulators and steering.',
    'Power from dedicated 6V BEC/regulator rather than microcontroller 5V rail.',
    'TowerPro', 'MG996R', 'Actuator Bin 03',
    '{"stall_torque":"11 kg-cm @ 6V","voltage":"4.8-7.2V","rotation":"180 deg"}'::jsonb,
    FALSE, 24, 24, 0, 0, 4, 'Good', 'Available', 9.50,
    ARRAY['/images/components/mg996r-servo.jpg']
  ),
  (
    '55555555-5555-5555-5555-555555555512',
    '22222222-2222-2222-2222-222222222202', '33333333-3333-3333-3333-333333333304', '44444444-4444-4444-4444-444444444402',
    'BNO055 9-DOF Absolute Orientation IMU', 'RAE-IMU-012',
    'Bosch BNO055 9-axis sensor fusion IMU outputting quaternions and Euler angles over I2C.',
    'I2C address 0x28 default. Calibrate magnetometer away from ferrous benches.',
    'Adafruit / Bosch', 'BNO055', 'Sensor Tray 05',
    '{"interface":"I2C / UART","dof":9,"voltage":"3.3V-5V"}'::jsonb,
    FALSE, 14, 14, 0, 0, 3, 'New', 'Available', 34.00,
    ARRAY['/images/components/bno055-imu.jpg']
  )
ON CONFLICT (sku) DO NOTHING;

-- Serialized component assets (oscilloscopes, multimeters, LiDARs, Raspberry Pis)
INSERT INTO component_assets (component_id, asset_code, serial_number, barcode, qr_payload, condition, status) VALUES
  ('55555555-5555-5555-5555-555555555504', 'AST-DMM-001', 'FLK115-99401', '8901001001', 'SMARTLAB:ASSET:AST-DMM-001', 'Good', 'Available'),
  ('55555555-5555-5555-5555-555555555504', 'AST-DMM-002', 'FLK115-99402', '8901001002', 'SMARTLAB:ASSET:AST-DMM-002', 'Good', 'Available'),
  ('55555555-5555-5555-5555-555555555508', 'AST-OSC-001', 'DS1ZA2411001', '8902001001', 'SMARTLAB:ASSET:AST-OSC-001', 'Good', 'Available'),
  ('55555555-5555-5555-5555-555555555508', 'AST-OSC-002', 'DS1ZA2411002', '8902001002', 'SMARTLAB:ASSET:AST-OSC-002', 'Good', 'Available'),
  ('55555555-5555-5555-5555-555555555510', 'AST-LID-001', 'SLAM-A1-7721', '8903001001', 'SMARTLAB:ASSET:AST-LID-001', 'Good', 'Available'),
  ('55555555-5555-5555-5555-555555555506', 'AST-RPI-001', 'RPI5-8G-3101', '8904001001', 'SMARTLAB:ASSET:AST-RPI-001', 'Good', 'Available')
ON CONFLICT (asset_code) DO NOTHING;
