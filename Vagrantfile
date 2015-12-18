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
         router.vm.network "private_network", type: "dhcp", virtualbox__intnet: "vboxnet0"
     end
     #config.vm.define "router2" do |router|
     #    router.vm.box = srx
     #    router.vm.hostname = "router2"
     #    router.ssh.insert_key = false
     #    router.vm.network "private_network", ip: "172.16.0.12", virtualbox__intnet: "test_net"
     #end
     #config.vm.define "host" do |host|
     #    host.vm.box = host_machine
     #    host.vm.network "private_network", ip: "172.16.0.1/24", virtualbox__intnet: "test_net"
     #    host.vm.synced_folder ".", "/vagrant"
     #    #host.vm.provision "ansible" do |ansible|
     #    #  ansible.sudo = true
     #    #  ansible.playbook = "pyez.yml"
     #    #end
     #end
end
