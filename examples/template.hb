interfaces {
    ge-0/0/0 {
        unit 0 {
            description "{{descrip1}}"
            family inet {
                dhcp;
            }
        }
    }
    ge-0/0/1 {
        unit 0 {
            description "{{descrip2}}"
            family inet {
                dhcp;
            }
        }
    }
}
