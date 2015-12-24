# Vagrant file for quickly spinning up a couple of test NETCONF
# boxes. Uses Juniper vSRX, requires the SSH private key in the
# examples directory.

srx = "juniper/ffp-12.1X47-D15.4-packetmode"

Vagrant.configure(2) do |config|
     config.vm.define "router1" do |router|
         router.vm.box = srx
         router.vm.hostname = "router1"
         router.ssh.insert_key = false
         router.vm.network "private_network", type: "dhcp"
     end
     config.vm.define "router2" do |router|
         router.vm.box = srx
         router.vm.hostname = "router2"
         router.ssh.insert_key = false
         router.vm.network "private_network", type: "dhcp"
     end
end
