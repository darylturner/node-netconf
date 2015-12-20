# All Vagrant configuration is done below. The "2" in Vagrant.configure
# configures the configuration version (we support older styles for
# backwards compatibility). Please don't change it unless you know what
# you're doing.

host_machine = "ubuntu/trusty64"
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
