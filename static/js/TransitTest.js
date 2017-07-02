function delay(ms) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, ms);
    });
}

function run_transit_tests() {
    // Hide stuff
    $("#alpha-warning").hide();
    $("#starter-city-picker").hide();
    $("#starter").hide();
        
    // Make all server interactions synchronous
    ASYNC_REQUIRED = false;
    
    // TEST-0: Add line
    var line_1 = NS_interface.line_selector_new();
    var t0_c1 = NS_map.primary_service().lines.length == 1;
    var t0_c2 = NS_map.primary_service().lines.indexOf(line_1) > -1;
    if (t0_c1 && t0_c2) {
        console.log("TEST-0 pass (add line)");
    } else {
        console.log("TEST-0 fail (add line)");
        return 1;
    }
    
    // TEST-1: Add station
    var station_1 = NS_interface.add_new_station(40.7306, -74.0000);
    var t1_c1 = NS_map.primary_service().stations.length == 1;
    var t1_c2 = NS_map.primary_service().stations.indexOf(station_1) > -1;
    var stop_1 = line_1.get_stop_by_station(station_1);
    var t1_c3 = stop_1 != null;
    if (t1_c1 && t1_c2 && t1_c3) {
        console.log("TEST-1 pass (add station)");
    } else {
        console.log("TEST-1 fail (add station)");
        return 2;
    }
    
    // TEST-2: Add station and edge
    var station_2 = NS_interface.add_new_station(40.7306, -74.0100);
    var t2_c1 = NS_map.primary_service().stations.length == 2;
    var t2_c2 = NS_map.primary_service().stations.indexOf(station_2) > -1;
    var stop_2 = line_1.get_stop_by_station(station_2);
    var t2_c3 = stop_2 != null;
    var edge_1 = line_1.get_edge_by_stops([stop_1, stop_2]);
    var t2_c4 = edge_1.has_station(station_1) && edge_1.has_station(station_2);
    var sp_1 = NS_interface.get_station_pair(station_1, station_2)[0];
    var t2_c5 = sp_1.stations.indexOf(station_1) > -1 && sp_1.stations.indexOf(station_2) > -1;
    if (t2_c1 && t2_c2 && t2_c3 && t2_c4 && t2_c5) {
        console.log("TEST-2 pass (add station and edge)");
    } else {
        console.log("TEST-2 fail (add station and edge)");
        console.log([t2_c1, t2_c2, t2_c3, t2_c4, t2_c5]);
        return 3;
    }
    
    // TEST-3: Add station and edge, same dir
    var station_3 = NS_interface.add_new_station(40.7306, -74.0200);
    var t3_c1 = NS_map.primary_service().stations.length == 3;
    var t3_c2 = NS_map.primary_service().stations.indexOf(station_3) > -1;
    var stop_3 = line_1.get_stop_by_station(station_3);
    var t3_c3 = stop_3 != null;
    var edge_2 = line_1.get_edge_by_stops([stop_2, stop_3]);
    var t3_c4 = edge_2.has_station(station_2) && edge_2.has_station(station_3);
    var sp_2 = NS_interface.get_station_pair(station_2, station_3)[0];
    var t3_c5 = sp_2.stations.indexOf(station_2) > -1 && sp_2.stations.indexOf(station_3) > -1;
    if (t3_c1 && t3_c2 && t3_c3 && t3_c4 && t3_c5) {
        console.log("TEST-3 pass (add station and edge, same dir)");
    } else {
        console.log("TEST-3 fail (add station and edge, same dir)");
        console.log([t3_c1, t3_c2, t3_c3, t3_c4, t3_c5]);
        return 4;
    }
    
    // TEST-4: Add station and edge, opposite dir
    var station_4 = NS_interface.add_new_station(40.7306, -73.9900);
    var t4_c1 = NS_map.primary_service().stations.length == 4;
    var t4_c2 = NS_map.primary_service().stations.indexOf(station_4) > -1;
    var stop_4 = line_1.get_stop_by_station(station_4);
    var t4_c3 = stop_4 != null;
    var edge_3 = line_1.get_edge_by_stops([stop_1, stop_4]);
    var t4_c4 = edge_3.has_station(station_1) && edge_3.has_station(station_4);
    var sp_3 = NS_interface.get_station_pair(station_1, station_4)[0];
    var t4_c5 = sp_3.stations.indexOf(station_1) > -1 && sp_3.stations.indexOf(station_4) > -1;
    if (t4_c1 && t4_c2 && t4_c3 && t4_c4 && t4_c5) {
        console.log("TEST-4 pass (add station and edge, opposite dir)");
    } else {
        console.log("TEST-4 fail (add station and edge, opposite dir)");
        console.log([t4_c1, t4_c2, t4_c3, t4_c4, t4_c5]);
        return 5;
    }
    
    // TEST-5: Delete station and edges
    NS_interface.remove_station(station_1.sid);
    var t5_c1 = NS_map.primary_service().stations.length == 3;
    var t5_c2 = NS_map.primary_service().stations.indexOf(station_1) == -1;
    var t5_c3 = line_1.get_stop_by_station(station_1) == null;
    var t5_c4 = line_1.get_edge_by_stops([stop_1, stop_2]) == null;
    var t5_c5 = line_1.get_edge_by_stops([stop_1, stop_4]) == null;
    var edge_4 = line_1.get_edge_by_stops([stop_2, stop_4]);
    var t5_c6 = edge_4.has_station(station_2) && edge_4.has_station(station_4);
    var sp_4 = NS_interface.get_station_pair(station_2, station_4)[0];
    var t5_c7 = sp_4.stations.indexOf(station_2) > -1 && sp_4.stations.indexOf(station_4) > -1;
    if (t5_c1 && t5_c2 && t5_c3 && t5_c4 && t5_c5 && t5_c6 && t5_c7) {
        console.log("TEST-5 pass (delete station and edges)");
    } else {
        console.log("TEST-5 fail (delete station and edges)");
        console.log([t5_c1, t5_c2, t5_c3, t5_c4, t5_c5, t5_c6, t5_c7]);
        return 6;
    }
    
    // TEST-6: Add station and edge, opposite dir
    var station_5 = NS_interface.add_new_station(40.7306, -73.9800);
    var t6_c1 = NS_map.primary_service().stations.length == 4;
    var t6_c2 = NS_map.primary_service().stations.indexOf(station_5) > -1;
    var stop_5 = line_1.get_stop_by_station(station_5);
    var t6_c3 = stop_5 != null;
    var edge_4 = line_1.get_edge_by_stops([stop_4, stop_5]);
    var t6_c4 = edge_4.has_station(station_4) && edge_4.has_station(station_5);
    var sp_5 = NS_interface.get_station_pair(station_4, station_5)[0];
    var t6_c5 = sp_5.stations.indexOf(station_4) > -1 && sp_5.stations.indexOf(station_5) > -1;
    if (t6_c1 && t6_c2 && t6_c3 && t6_c4 && t6_c5) {
        console.log("TEST-6 pass (add station and edge, opposite dir)");
    } else {
        console.log("TEST-6 fail (add station and edge, opposite dir)");
        console.log([t6_c1, t6_c2, t6_c3, t6_c4, t6_c5]);
        return 7;
    }
    
    // TEST-7: Add line
    var line_2 = NS_interface.line_selector_new();
    var t7_c1 = NS_map.primary_service().lines.length == 2;
    var t7_c2 = NS_map.primary_service().lines.indexOf(line_2) > -1;
    if (t7_c1 && t7_c2) {
        console.log("TEST-7 pass (add line)");
    } else {
        console.log("TEST-7 fail (add line)");
        return 8;
    }
    
    // TEST-8: Add station
    var station_6 = NS_interface.add_new_station(40.7406, -74.0200);
    var t8_c1 = NS_map.primary_service().stations.length == 5;
    var t8_c2 = NS_map.primary_service().stations.indexOf(station_6) > -1;
    var stop_6 = line_2.get_stop_by_station(station_6);
    var t8_c3 = stop_6 != null;
    if (t8_c1 && t8_c2 && t8_c3) {
        console.log("TEST-8 pass (add station)");
    } else {
        console.log("TEST-8 fail (add station)");
        return 9;
    }
    
    // TEST-9: Add line to station
    NS_interface.add_stop_to_station(station_2.sid);
    var stop_2_2 = line_2.get_stop_by_station(station_2);
    var t9_c1 = stop_2_2 != null;
    var edge_5 = line_2.get_edge_by_stops([stop_6, stop_2_2]);
    var t9_c2 = edge_5.has_station(station_2) && edge_5.has_station(station_6);
    var sp_6 = NS_interface.get_station_pair(station_2, station_6)[0];
    var t9_c3 = sp_6.stations.indexOf(station_2) > -1 && sp_6.stations.indexOf(station_6) > -1;
    if (t9_c1 && t9_c2 && t9_c3) {
        console.log("TEST-9 pass (add line to station)");
    } else {
        console.log("TEST-9 fail (add line to station)");
        return 10;
    }
    
    // TEST-10: Add line to station, shared stretch
    NS_interface.add_stop_to_station(station_4.sid);
    var stop_4_2 = line_2.get_stop_by_station(station_4);
    var t10_c1 = stop_4_2 != null;
    var edge_6 = line_2.get_edge_by_stops([stop_4_2, stop_2_2]);
    var t10_c2 = edge_6.has_station(station_2) && edge_6.has_station(station_4);
    var t10_c3 = sp_4.stations.indexOf(station_2) > -1 && sp_4.stations.indexOf(station_4) > -1;
    var sp_4_lines = [sp_4.line_control_points[0].line, sp_4.line_control_points[1].line];
    var t10_c4 = sp_4_lines.indexOf(line_1) > -1 && sp_4_lines.indexOf(line_2) > -1;
    if (t10_c1 && t10_c2 && t10_c3 && t10_c4) {
        console.log("TEST-10 pass (add line to station, shared stretch)");
    } else {
        console.log("TEST-10 fail (add line to station, shared stretch)");
        return 11;
    }
    
    // TEST-11: Add station
    var station_7 = NS_interface.add_new_station(40.7406, -73.9800);
    var t11_c1 = NS_map.primary_service().stations.length == 6;
    var t11_c2 = NS_map.primary_service().stations.indexOf(station_7) > -1;
    var stop_7 = line_2.get_stop_by_station(station_7);
    var t11_c3 = stop_7 != null;
    var edge_7 = line_2.get_edge_by_stops([stop_4_2, stop_7]);
    var t11_c4 = edge_7.has_station(station_4) && edge_7.has_station(station_7);
    var sp_7 = NS_interface.get_station_pair(station_4, station_7)[0];
    var t11_c5 = sp_7.stations.indexOf(station_4) > -1 && sp_7.stations.indexOf(station_7) > -1;
    if (t11_c1 && t11_c2 && t11_c3 && t11_c4 && t11_c5) {
        console.log("TEST-11 pass (add station)");
    } else {
        console.log("TEST-11 fail (add station)");
        return 12;
    }
    
    // TEST-12: Add station, double shared stretch
    var station_8 = NS_interface.add_new_station(40.7306, -74.0000);
    var t12_c1 = NS_map.primary_service().stations.length == 7;
    var t12_c2 = NS_map.primary_service().stations.indexOf(station_8) > -1;
    var stop_8 = line_2.get_stop_by_station(station_8);
    var t12_c3 = stop_8 != null;
    var edge_8 = line_2.get_edge_by_stops([stop_2_2, stop_8]);
    var edge_9 = line_2.get_edge_by_stops([stop_8, stop_4_2]);
    var t12_c4 = edge_8.has_station(station_2) && edge_8.has_station(station_8);
    var t12_c5 = edge_9.has_station(station_8) && edge_9.has_station(station_4);
    var t12_c6 = line_2.get_edge_by_stops([stop_2_2, stop_4_2]) == null;
    var sp_8 = NS_interface.get_station_pair(station_2, station_8)[0];
    var sp_9 = NS_interface.get_station_pair(station_8, station_4)[0];
    var t12_c7 = sp_8.stations.indexOf(station_2) > -1 && sp_8.stations.indexOf(station_8) > -1;
    var t12_c8 = sp_9.stations.indexOf(station_8) > -1 && sp_9.stations.indexOf(station_4) > -1;
    var sp_8_lines = [sp_8.line_control_points[0].line, sp_8.line_control_points[1].line];
    var t12_c9 = sp_8_lines.indexOf(line_1) > -1 && sp_8_lines.indexOf(line_2) > -1;
    var sp_9_lines = [sp_9.line_control_points[0].line, sp_9.line_control_points[1].line];
    var t12_c10 = sp_9_lines.indexOf(line_1) > -1 && sp_9_lines.indexOf(line_2) > -1;
    if (t12_c1 && t12_c2 && t12_c3 && t12_c4 && t12_c5 && t12_c6 && t12_c7 && t12_c8 && t12_c9 && t12_c10) {
        console.log("TEST-12 pass (add station, double shared stretch)");
    } else {
        console.log("TEST-12 fail (add station, double shared stretch)");
        return 13;
    }
    
    // TEST-13: Update active line
    NS_interface.update_line_selector(line_1.sid);
    var t13_c1 = NS_interface.active_line == line_1;
    if (t13_c1) {
        console.log("TEST-13 pass (update active line)");
    } else {
        console.log("TEST-13 fail (update active line)");
        return 14;
    }
    
    // TEST-14: Add line to station, double shared stretch
    NS_interface.add_stop_to_station(station_8.sid);
    var stop_8_1 = line_1.get_stop_by_station(station_8);
    var t14_c1 = stop_8_1 != null;
    var edge_10 = line_1.get_edge_by_stops([stop_2, stop_8_1]);
    var edge_11 = line_1.get_edge_by_stops([stop_8_1, stop_4]);
    var t14_c2 = edge_10.has_station(station_2) && edge_10.has_station(station_8);
    var t14_c3 = edge_11.has_station(station_8) && edge_11.has_station(station_4);
    var sp_8_lines = [sp_8.line_control_points[0].line, sp_8.line_control_points[1].line];
    var t14_c4 = sp_8_lines.indexOf(line_1) > -1 && sp_8_lines.indexOf(line_2) > -1;
    var sp_9_lines = [sp_9.line_control_points[0].line, sp_9.line_control_points[1].line];
    var t14_c5 = sp_9_lines.indexOf(line_1) > -1 && sp_9_lines.indexOf(line_2) > -1;
    var t14_c6 = NS_interface.get_station_pair(station_2, station_4) == null;
    if (t14_c1 && t14_c2 && t14_c3 && t14_c4 && t14_c5 && t14_c6) {
        console.log("TEST-14 pass (add line to station, double shared stretch)");
    } else {
        console.log("TEST-14 fail (add line to station, double shared stretch)");
        return 15;
    }
    
    // TEST-15: Remove extra line from station
    NS_interface.remove_line_from_station(station_8.sid, line_2.sid);
    var t15_c1 = line_2.get_stop_by_station(station_8) == null;
    var t15_c2 = line_2.get_edge_by_stops([stop_2_2, stop_8]) == null && line_2.get_edge_by_stops([stop_8, stop_4_2]) == null;
    var edge_12 = line_2.get_edge_by_stops([stop_2_2, stop_4_2]);
    var t15_c3 = edge_12.has_station(station_2) && edge_12.has_station(station_4);
    var sp_8_lines = [sp_8.line_control_points[0].line, sp_8.line_control_points[1].line];
    var t15_c4 = sp_8_lines.indexOf(line_1) > -1 && sp_8_lines.indexOf(line_2) > -1;
    var sp_9_lines = [sp_9.line_control_points[0].line, sp_9.line_control_points[1].line];
    var t15_c5 = sp_9_lines.indexOf(line_1) > -1 && sp_9_lines.indexOf(line_2) > -1; 
    if (t15_c1 && t15_c2 && t15_c3 && t15_c4 && t15_c5) {
        console.log("TEST-15 pass (remove extra line from station)");
    } else {
        console.log("TEST-15 fail (remove extra line from station)");
        return 16;
    }
    
    // TEST-16: Remove sole line from station
    NS_interface.remove_line_from_station(station_8.sid, line_1.sid);
    var t16_c1 = line_1.get_stop_by_station(station_8) == null;
    var t16_c2 = line_1.get_edge_by_stops([stop_2, stop_8_1]) == null && line_1.get_edge_by_stops([stop_8_1, stop_4]) == null;
    var edge_13 = line_2.get_edge_by_stops([stop_2_2, stop_4_2]);
    var t16_c3 = edge_13.has_station(station_2) && edge_13.has_station(station_4);
    var t16_c4 = NS_interface.get_station_pair(station_2, station_8) == null && NS_interface.get_station_pair(station_8, station_4) == null;
    var sp_10 = NS_interface.get_station_pair(station_2, station_4)[0];
    var sp_10_lines = [sp_10.line_control_points[0].line, sp_10.line_control_points[1].line];
    var t16_c5 = sp_10_lines.indexOf(line_1) > -1 && sp_10_lines.indexOf(line_2) > -1;
    var t16_c6 = NS_map.primary_service().stations.length == 6;
    var t16_c7 = NS_map.primary_service().stations.indexOf(station_8) == -1;
    var t16_c8 = line_1.get_stop_by_station(station_8) == null && line_2.get_stop_by_station(station_8) == null;
    if (t16_c1 && t16_c2 && t16_c3 && t16_c4 && t16_c5 && t16_c6 && t16_c7 && t16_c8) {
        console.log("TEST-16 pass (remove sole line from station)");
    } else {
        console.log("TEST-16 fail (remove sole line from station)");
        return 17;
    }
    
    // TEST-17: Remove extra line from station
    NS_interface.remove_line_from_station(station_4.sid, line_1.sid);
    var t17_c1 = line_1.get_stop_by_station(station_4) == null;
    var t17_c2 = line_1.get_edge_by_stops([stop_2, stop_4]) == null && line_1.get_edge_by_stops([stop_4, stop_5]) == null;
    var edge_13 = line_1.get_edge_by_stops([stop_2, stop_5]);
    var t17_c3 = edge_13.has_station(station_2) && edge_13.has_station(station_5);
    var t17_c4 = sp_10.line_control_points.length == 1;
    var sp_10_lines = [sp_10.line_control_points[0].line];
    var t17_c5 = sp_10_lines.indexOf(line_1) == -1 && sp_10_lines.indexOf(line_2) > -1;
    var sp_11 = NS_interface.get_station_pair(station_2, station_5)[0];
    var t17_c6 = sp_11.line_control_points.length == 1;
    var sp_11_lines = [sp_11.line_control_points[0].line];
    var t17_c7 = sp_11_lines.indexOf(line_1) > -1;
    if (t17_c1 && t17_c2 && t17_c3 && t17_c4 && t17_c5 && t17_c6 && t17_c7) {
        console.log("TEST-17 pass (remove extra line from station)");
    } else {
        console.log("TEST-17 fail (remove extra line from station)");
        return 18;
    }
    
    // TEST-18: Delete station and edges
    NS_interface.remove_station(station_2.sid);
    var t18_c1 = NS_map.primary_service().stations.length == 5;
    var t18_c2 = NS_map.primary_service().stations.indexOf(station_2) == -1;
    var t18_c3 = line_1.get_stop_by_station(station_2) == null && line_2.get_stop_by_station(station_2) == null;
    var t18_c4 = line_1.get_edge_by_stops([stop_2, stop_5]) == null && line_1.get_edge_by_stops([stop_2, stop_3]) == null;
    var t18_c5 = line_2.get_edge_by_stops([stop_2_2, stop_6]) == null && line_2.get_edge_by_stops([stop_2_2, stop_4_2]) == null;
    var edge_14 = line_1.get_edge_by_stops([stop_3, stop_5]);
    var t18_c6 = edge_14.has_station(station_3) && edge_14.has_station(station_5);
    var edge_15 = line_2.get_edge_by_stops([stop_6, stop_4_2]);
    var t18_c7 = edge_15.has_station(station_6) && edge_15.has_station(station_4);
    var t18_c8 = NS_interface.get_station_pair(station_2, station_3) == null && NS_interface.get_station_pair(station_2, station_5) == null;
    var t18_c9 = NS_interface.get_station_pair(station_2, station_6) == null && NS_interface.get_station_pair(station_2, station_4) == null;
    var sp_12 = NS_interface.get_station_pair(station_3, station_5)[0];
    var t18_c10 = sp_12.line_control_points.length == 1;
    var t18_c11 = sp_12.line_control_points[0].line == line_1;
    var t18_c12 = sp_12.stations.indexOf(station_3) > -1 && sp_12.stations.indexOf(station_5) > -1;
    var sp_13 = NS_interface.get_station_pair(station_4, station_6)[0];
    var t18_c13 = sp_13.line_control_points.length == 1;
    var t18_c14 = sp_13.line_control_points[0].line == line_2;
    var t18_c15 = sp_13.stations.indexOf(station_4) > -1 && sp_13.stations.indexOf(station_6) > -1;
    if (t18_c1 && t18_c2 && t18_c3 && t18_c4 && t18_c5 && t18_c6 && t18_c7 && t18_c8 && t18_c9 && t18_c10 && t18_c11 && t18_c12 && t18_c13 && t18_c14 && t18_c15) {
        console.log("TEST-18 pass (delete station and edges)");
    } else {
        console.log("TEST-18 fail (delete station and edges)");
        return 19;
    }
    
    return 0;
}