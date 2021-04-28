import { ethers, network } from "hardhat"
import { expect } from "chai"
import { latest, duration, increase } from "./utilities"

describe("MasterChefJoe", function () {
  before(async function () {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
    this.dev = this.signers[3]
    this.treasury = this.signers[4]
    this.minter = this.signers[5]

    this.MasterChef = await ethers.getContractFactory("MasterChefJoe")
    this.JoeToken = await ethers.getContractFactory("JoeToken")
    this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.minter)

    this.devPercent = 200
    this.treasuryPercent = 200
    this.lpPercent = 1000 - this.devPercent - this.treasuryPercent
    this.joePerSec = 100
    this.secOffset = 1
    this.tokenOffset = 3
    this.reward = (sec: number, percent: number) => (sec * this.joePerSec * percent) / 1000
  })

  beforeEach(async function () {
    this.joe = await this.JoeToken.deploy()
    await this.joe.deployed()
  })

  it("should set correct state variables", async function () {
    // We make start time 60 seconds past the last block
    const startTime = (await latest()).add(60)
    this.chef = await this.MasterChef.deploy(
      this.joe.address,
      this.dev.address,
      this.treasury.address,
      "100",
      startTime,
      this.devPercent,
      this.treasuryPercent
    )
    await this.chef.deployed()

    await this.joe.transferOwnership(this.chef.address)

    const joe = await this.chef.joe()
    const devaddr = await this.chef.devaddr()
    const treasuryaddr = await this.chef.treasuryaddr()
    const owner = await this.joe.owner()
    const devPercent = await this.chef.devPercent()
    const treasuryPercent = await this.chef.treasuryPercent()

    expect(joe).to.equal(this.joe.address)
    expect(devaddr).to.equal(this.dev.address)
    expect(treasuryaddr).to.equal(this.treasury.address)
    expect(owner).to.equal(this.chef.address)
    expect(devPercent).to.equal(this.devPercent)
    expect(treasuryPercent).to.equal(this.treasuryPercent)
  })

  it("should allow dev and only dev to update dev", async function () {
    const startTime = (await latest()).add(60)
    this.chef = await this.MasterChef.deploy(
      this.joe.address,
      this.dev.address,
      this.treasury.address,
      "100",
      startTime,
      this.devPercent,
      this.treasuryPercent
    )
    await this.chef.deployed()

    expect(await this.chef.devaddr()).to.equal(this.dev.address)

    await expect(this.chef.connect(this.bob).dev(this.bob.address, { from: this.bob.address })).to.be.revertedWith("dev: wut?")

    await this.chef.connect(this.dev).dev(this.bob.address, { from: this.dev.address })

    expect(await this.chef.devaddr()).to.equal(this.bob.address)

    await this.chef.connect(this.bob).dev(this.alice.address, { from: this.bob.address })

    expect(await this.chef.devaddr()).to.equal(this.alice.address)
  })

  it("should check dev percent is set correctly", async function () {
    const startTime = (await latest()).add(60)
    this.chef = await this.MasterChef.deploy(
      this.joe.address,
      this.dev.address,
      this.treasury.address,
      "100",
      startTime,
      this.devPercent,
      this.treasuryPercent
    )
    await this.chef.deployed()

    await this.chef.setDevPercent(this.devPercent) // t-57
    await this.chef.setTreasuryPercent(this.treasuryPercent) // t-56
    expect(await this.chef.devPercent()).to.equal("200")
    // We don't test negative values because function only takes in unsigned ints
    await expect(this.chef.setDevPercent("1200")).to.be.revertedWith("setDevPercent: invalid percent value")
    await expect(this.chef.setDevPercent("900")).to.be.revertedWith("setDevPercent: total percent over max")
  })

  it("should check treasury percent is set correctly", async function () {
    const startTime = (await latest()).add(60)
    this.chef = await this.MasterChef.deploy(
      this.joe.address,
      this.dev.address,
      this.treasury.address,
      "100",
      startTime,
      this.devPercent,
      this.treasuryPercent
    )
    await this.chef.deployed()

    await this.chef.setDevPercent(this.devPercent) // t-57
    await this.chef.setTreasuryPercent(this.treasuryPercent) // t-56
    expect(await this.chef.treasuryPercent()).to.equal("200")
    // We don't test negative values because function only takes in unsigned ints
    await expect(this.chef.setTreasuryPercent("1200")).to.be.revertedWith("setTreasuryPercent: invalid percent value")
    await expect(this.chef.setTreasuryPercent("900")).to.be.revertedWith("setTreasuryPercent: total percent over max")
  })

  context("With ERC/LP token added to the field", function () {
    beforeEach(async function () {
      this.lp = await this.ERC20Mock.deploy("LPToken", "LP", "10000000000")

      await this.lp.transfer(this.alice.address, "1000")

      await this.lp.transfer(this.bob.address, "1000")

      await this.lp.transfer(this.carol.address, "1000")

      this.lp2 = await this.ERC20Mock.deploy("LPToken2", "LP2", "10000000000")

      await this.lp2.transfer(this.alice.address, "1000")

      await this.lp2.transfer(this.bob.address, "1000")

      await this.lp2.transfer(this.carol.address, "1000")
    })

    it("should not allow same LP token to be added twice", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MasterChef.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        "100",
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed()

      await this.chef.add("100", this.lp.address)
      await expect(this.chef.add("100", this.lp.address)).to.be.revertedWith("add: LP already added")
    })

    it("should allow emergency withdraw", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MasterChef.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        "100",
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed()

      await this.chef.add("100", this.lp.address)

      await this.lp.connect(this.bob).approve(this.chef.address, "1000")

      await this.chef.connect(this.bob).deposit(0, "100")

      expect(await this.lp.balanceOf(this.bob.address)).to.equal("900")

      await this.chef.connect(this.bob).emergencyWithdraw(0)

      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
    })

    it("should give out JOEs only after farming time", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MasterChef.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59

      await this.joe.transferOwnership(this.chef.address) // t-58
      await this.chef.setDevPercent(this.devPercent) // t-57
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-56

      await this.chef.add("100", this.lp.address) // t-55

      await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-54
      await this.chef.connect(this.bob).deposit(0, "100") // t-53
      increase(duration.seconds(40)) // t-13

      await this.chef.connect(this.bob).deposit(0, "0") // t-12
      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      increase(duration.seconds(10)) // t-2

      await this.chef.connect(this.bob).deposit(0, "0") // t-1
      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      increase(duration.seconds(10)) // t+9

      await this.chef.connect(this.bob).deposit(0, "0") // t+10
      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(600, 660)

      increase(duration.seconds(4)) // t+14
      await this.chef.connect(this.bob).deposit(0, "0") // t+15

      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(900, 960)
      expect(await this.joe.balanceOf(this.dev.address)).to.be.within(300, 320)
      expect(await this.joe.balanceOf(this.treasury.address)).to.be.within(300, 320)
      expect(await this.joe.totalSupply()).to.be.within(1500, 1600)
    })

    it("should not distribute JOEs if no one deposit", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MasterChef.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59

      await this.joe.transferOwnership(this.chef.address) // t-58
      await this.chef.setDevPercent(this.devPercent) // t-57
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-56

      await this.chef.add("100", this.lp.address) // t-55
      await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-54
      increase(duration.seconds(100)) // t+54

      expect(await this.joe.totalSupply()).to.equal("0")
      increase(duration.seconds(5)) // t+59
      expect(await this.joe.totalSupply()).to.equal("0")
      increase(duration.seconds(5)) // t+64
      await this.chef.connect(this.bob).deposit(0, "10") // t+65
      expect(await this.joe.totalSupply()).to.equal("0")
      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.joe.balanceOf(this.dev.address)).to.equal("0")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("990")
      increase(duration.seconds(10)) // t+75
      await this.chef.connect(this.bob).withdraw(0, "10") // t+76

      // Use an offset of 1 second due to runtime
      expect(await this.joe.totalSupply()).to.be.within(1100, 1200)
      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(660, 720)
      expect(await this.joe.balanceOf(this.dev.address)).to.be.within(220, 240)
      expect(await this.joe.balanceOf(this.treasury.address)).to.be.within(220, 240)
    })

    it("should distribute JOEs properly for each staker", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MasterChef.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59

      await this.joe.transferOwnership(this.chef.address) // t-58
      await this.chef.setDevPercent(this.devPercent) // t-57
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-56

      await this.chef.add("100", this.lp.address) // t-55
      await this.lp.connect(this.alice).approve(this.chef.address, "1000", {
        from: this.alice.address,
      }) // t-54
      await this.lp.connect(this.bob).approve(this.chef.address, "1000", {
        from: this.bob.address,
      }) // t-53
      await this.lp.connect(this.carol).approve(this.chef.address, "1000", {
        from: this.carol.address,
      }) // t-52

      // Alice deposits 10 LPs at t+10
      increase(duration.seconds(61)) // t+9
      await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+10
      // Bob deposits 20 LPs at t+14
      increase(duration.seconds(3)) // t+13
      await this.chef.connect(this.bob).deposit(0, "20") // t+14
      // Carol deposits 30 LPs at block t+18
      increase(duration.seconds(3)) // t+17
      await this.chef.connect(this.carol).deposit(0, "30", { from: this.carol.address }) // t+18
      // Alice deposits 10 more LPs at t+25. At this point:
      //   Alice should have: 4*60 + 4*1/3*60 + 2*1/6*60 = 340 (+60)
      //   Dev should have: 10*100*0.2 = 200 (+20)
      //   Treasury should have: 10*100*0.2 = 200 (+20)
      //   MasterChef shoudl have: 1000 - 340 - 200 - 200 = 260 (+100)
      increase(duration.seconds(1)) // t+19
      await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+20
      expect(await this.joe.totalSupply()).to.be.within(1000, 1100)
      // Becaues LP rewards are divided among participants and rounded down, we account
      // for rounding errors with an offset
      expect(await this.joe.balanceOf(this.alice.address)).to.be.within(340 - this.tokenOffset, 400)
      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.joe.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.joe.balanceOf(this.dev.address)).to.be.within(200 - this.tokenOffset, 220)
      expect(await this.joe.balanceOf(this.treasury.address)).to.be.within(200 - this.tokenOffset, 220)
      expect(await this.joe.balanceOf(this.chef.address)).to.be.within(260, 360 + this.tokenOffset)
      // Bob withdraws 5 LPs at block 330. At this point:
      //   Bob should have: 4*2/3*60 + 2*2/6*60 + 10*2/7*60 = 371 (+60)
      //   Dev should have: 20*100*0.2= 400 (+20)
      //   Treasury should have: 20*100*0.2 = 400 (+20)
      //   MasterChef should have: 260 + 1000 - 371 - 200 - 200 = 489 (+100)
      increase(duration.seconds(9)) // t+29
      await this.chef.connect(this.bob).withdraw(0, "5", { from: this.bob.address }) // t+30
      expect(await this.joe.totalSupply()).to.be.within(2000, 2100)
      expect(await this.joe.balanceOf(this.alice.address)).to.be.within(340 - this.tokenOffset, 400)
      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(371 - this.tokenOffset, 431)
      expect(await this.joe.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.joe.balanceOf(this.dev.address)).to.be.within(400 - this.tokenOffset, 420)
      expect(await this.joe.balanceOf(this.treasury.address)).to.be.within(400 - this.tokenOffset, 420)
      expect(await this.joe.balanceOf(this.chef.address)).to.be.within(489, 589 + this.tokenOffset)
      // Alice withdraws 20 LPs at block 340.
      // Bob withdraws 15 LPs at block 350.
      // Carol withdraws 30 LPs at block 360.
      increase(duration.seconds(9)) // t+39
      await this.chef.connect(this.alice).withdraw(0, "20", { from: this.alice.address }) // t+40
      increase(duration.seconds(9)) // t+49
      await this.chef.connect(this.bob).withdraw(0, "15", { from: this.bob.address }) // t+50
      increase(duration.seconds(9)) // t+59
      await this.chef.connect(this.carol).withdraw(0, "30", { from: this.carol.address }) // t+60
      expect(await this.joe.totalSupply()).to.be.within(5000, 5100)
      // Alice should have: 340 + 10*2/7*60 + 10*2/6.5*60 = 696 (+60)
      expect(await this.joe.balanceOf(this.alice.address)).to.be.within(696 - this.tokenOffset, 756)
      // Bob should have: 371 + 10*1.5/6.5*60 + 10*1.5/4.5*60 = 709 (+60)
      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(709 - this.tokenOffset, 769)
      // Carol should have: 2*3/6*60 + 10*3/7*60 + 10*3/6.5*60 + 10*3/4.5*60 + 10*60 = 1594 (+60)
      expect(await this.joe.balanceOf(this.carol.address)).to.be.within(1594 - this.tokenOffset, 1654)
      // Dev should have: 50*100*0.2 = 1000 (+20)
      // Treasury should have: 50*100*0.2 = 1000 (+20)
      expect(await this.joe.balanceOf(this.dev.address)).to.be.within(1000 - this.tokenOffset, 1020)
      expect(await this.joe.balanceOf(this.treasury.address)).to.be.within(1000 - this.tokenOffset, 1020)
      // Masterchef should have nothing
      expect(await this.joe.balanceOf(this.chef.address)).to.be.within(0, 0 + this.tokenOffset)

      // // All of them should have 1000 LPs back.
      expect(await this.lp.balanceOf(this.alice.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.carol.address)).to.equal("1000")
    })

    it("should give proper JOEs allocation to each pool", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MasterChef.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59

      await this.joe.transferOwnership(this.chef.address) // t-58
      await this.chef.setDevPercent(this.devPercent) // t-57
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-56

      await this.lp.connect(this.alice).approve(this.chef.address, "1000", { from: this.alice.address }) // t-55
      await this.lp2.connect(this.bob).approve(this.chef.address, "1000", { from: this.bob.address }) // t-54
      // Add first LP to the pool with allocation 1
      await this.chef.add("10", this.lp.address) // t-53
      // Alice deposits 10 LPs at t+10
      increase(duration.seconds(62)) // t+9
      await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+10
      // Add LP2 to the pool with allocation 2 at t+20
      increase(duration.seconds(9)) // t+19
      await this.chef.add("20", this.lp2.address) // t+20
      // Alice's pending reward should be: 9*60 + 1*1/3*60 = 560 (+60) (the 10th second is split among the two pools)
      expect(await this.chef.pendingJoe(0, this.alice.address)).to.be.within(560 - this.tokenOffset, 620)
      // Bob deposits 10 LP2s at t+25
      increase(duration.seconds(4)) // t+24
      await this.chef.connect(this.bob).deposit(1, "5", { from: this.bob.address }) // t+25
      // Alice's pending reward should be: 560 + 5*1/3*60 = 660 (+60)
      expect(await this.chef.pendingJoe(0, this.alice.address)).to.be.within(660 - this.tokenOffset, 720)
      increase(duration.seconds(5)) // t+30
      // Alice's pending reward should be: 660 + 5*1/3*60 = 760 (+60)
      // Bob's pending reward should be: 5*2/3*60 = 200 (+60)
      expect(await this.chef.pendingJoe(0, this.alice.address)).to.be.within(760 - this.tokenOffset, 820)
      expect(await this.chef.pendingJoe(1, this.bob.address)).to.be.within(200 - this.tokenOffset, 260)
      // Alice and Bob should not have pending rewards in pools they're not staked in
      expect(await this.chef.pendingJoe(1, this.alice.address)).to.equal("0")
      expect(await this.chef.pendingJoe(0, this.bob.address)).to.equal("0")

      // Make sure they have receive the same amount as what was pending
      await this.chef.connect(this.alice).withdraw(0, "10", { from: this.alice.address }) // t+31
      // Alice should have: 760 + 1*1/3*60 = 780 (+60)
      expect(await this.joe.balanceOf(this.alice.address)).to.be.within(780 - this.tokenOffset, 840)
      await this.chef.connect(this.bob).withdraw(1, "5", { from: this.bob.address }) // t+32
      // Bob should have: 200 + 2*2/3*60 = 280 (+60)
      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(280 - this.tokenOffset, 340)
    })

    it("should give proper JOEs after updating emission rate", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MasterChef.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59

      await this.joe.transferOwnership(this.chef.address) // t-58
      await this.chef.setDevPercent(this.devPercent) // t-57
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-56

      await this.lp.connect(this.alice).approve(this.chef.address, "1000", { from: this.alice.address }) // t-55
      await this.chef.add("10", this.lp.address) // t-54
      // Alice deposits 10 LPs at t+10
      increase(duration.seconds(63)) // t+9
      await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+10
      // At t+110, Alice should have: 100*100*0.6 = 6000 (+60)
      increase(duration.seconds(100)) // t+110
      expect(await this.chef.pendingJoe(0, this.alice.address)).to.be.within(6000, 6060)
      // Lower emission rate to 40 JOE per sec
      await this.chef.updateEmissionRate("40") // t+111
      // At t+115, Alice should have: 6000 + 1*100*0.6 + 4*40*0.6 = 6156 (+24)
      increase(duration.seconds(4)) // t+115
      expect(await this.chef.pendingJoe(0, this.alice.address)).to.be.within(6156, 6216)
    })
  })

  after(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    })
  })
})
