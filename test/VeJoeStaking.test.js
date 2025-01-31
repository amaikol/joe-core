// @ts-nocheck
const { ethers, network, upgrades } = require("hardhat");
const { expect } = require("chai");
const { describe } = require("mocha");

describe("VeJoe Staking", function () {
  before(async function () {
    this.VeJoeStakingCF = await ethers.getContractFactory("VeJoeStaking");
    this.VeJoeTokenCF = await ethers.getContractFactory("VeJoeToken");
    this.JoeTokenCF = await ethers.getContractFactory("JoeToken");

    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.alice = this.signers[1];
    this.bob = this.signers[2];
    this.carol = this.signers[3];
  });

  beforeEach(async function () {
    this.veJoe = await this.VeJoeTokenCF.deploy();
    this.joe = await this.JoeTokenCF.deploy();

    await this.joe.mint(this.alice.address, ethers.utils.parseEther("1000"));
    await this.joe.mint(this.bob.address, ethers.utils.parseEther("1000"));
    await this.joe.mint(this.carol.address, ethers.utils.parseEther("1000"));

    this.baseGenerationRate = ethers.utils.parseEther("1");
    this.boostedGenerationRate = ethers.utils.parseEther("2");
    this.boostedThreshold = 5;
    this.boostedDuration = 50;
    this.maxCap = 200;

    this.veJoeStaking = await upgrades.deployProxy(this.VeJoeStakingCF, [
      this.joe.address, // _joe
      this.veJoe.address, // _veJoe
      this.baseGenerationRate, // _baseGenerationRate
      this.boostedGenerationRate, // _boostedGenerationRate
      this.boostedThreshold, // _boostedThreshold
      this.boostedDuration, // _boostedDuration
      this.maxCap, // _maxCap
    ]);
    await this.veJoe.transferOwnership(this.veJoeStaking.address);

    await this.joe
      .connect(this.alice)
      .approve(this.veJoeStaking.address, ethers.utils.parseEther("100000"));
    await this.joe
      .connect(this.bob)
      .approve(this.veJoeStaking.address, ethers.utils.parseEther("100000"));
    await this.joe
      .connect(this.carol)
      .approve(this.veJoeStaking.address, ethers.utils.parseEther("100000"));
  });

  describe("setMaxCap", function () {
    it("should not allow non-owner to setMaxCap", async function () {
      await expect(
        this.veJoeStaking.connect(this.alice).setMaxCap(200)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should not allow owner to set lower maxCap", async function () {
      expect(await this.veJoeStaking.maxCap()).to.be.equal(this.maxCap);

      await expect(
        this.veJoeStaking.connect(this.dev).setMaxCap(99)
      ).to.be.revertedWith(
        "VeJoeStaking: expected new _maxCap to be greater than existing maxCap"
      );
    });

    it("should not allow owner to set maxCap greater than upper limit", async function () {
      await expect(
        this.veJoeStaking.connect(this.dev).setMaxCap(100001)
      ).to.be.revertedWith(
        "VeJoeStaking: expected new _maxCap to be non-zero and <= 100000"
      );
    });

    it("should allow owner to setMaxCap", async function () {
      expect(await this.veJoeStaking.maxCap()).to.be.equal(this.maxCap);

      await this.veJoeStaking.connect(this.dev).setMaxCap(this.maxCap + 100);

      expect(await this.veJoeStaking.maxCap()).to.be.equal(this.maxCap + 100);
    });
  });

  describe("setBaseGenerationRate", function () {
    it("should not allow non-owner to setMaxCap", async function () {
      await expect(
        this.veJoeStaking
          .connect(this.alice)
          .setBaseGenerationRate(ethers.utils.parseEther("1.5"))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should not allow owner to setBaseGenerationRate greater than boostedGenerationRate", async function () {
      expect(await this.veJoeStaking.boostedGenerationRate()).to.be.equal(
        this.boostedGenerationRate
      );

      await expect(
        this.veJoeStaking
          .connect(this.dev)
          .setBaseGenerationRate(ethers.utils.parseEther("3"))
      ).to.be.revertedWith(
        "VeJoeStaking: expected new _baseGenerationRate to be less than boostedGenerationRate"
      );
    });

    it("should allow owner to setBaseGenerationRate", async function () {
      expect(await this.veJoeStaking.baseGenerationRate()).to.be.equal(
        this.baseGenerationRate
      );

      await this.veJoeStaking
        .connect(this.dev)
        .setBaseGenerationRate(ethers.utils.parseEther("1.5"));

      expect(await this.veJoeStaking.baseGenerationRate()).to.be.equal(
        ethers.utils.parseEther("1.5")
      );
    });
  });

  describe("setBoostedGenerationRate", function () {
    it("should not allow non-owner to setBoostedGenerationRate", async function () {
      await expect(
        this.veJoeStaking
          .connect(this.alice)
          .setBoostedGenerationRate(ethers.utils.parseEther("11"))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should not allow owner to setBoostedGenerationRate leq to baseGenerationRate", async function () {
      expect(await this.veJoeStaking.baseGenerationRate()).to.be.equal(
        this.baseGenerationRate
      );

      await expect(
        this.veJoeStaking
          .connect(this.dev)
          .setBoostedGenerationRate(ethers.utils.parseEther("0.99"))
      ).to.be.revertedWith(
        "VeJoeStaking: expected new _boostedGenerationRate to be greater than baseGenerationRate"
      );
    });

    it("should allow owner to setBoostedGenerationRate", async function () {
      expect(await this.veJoeStaking.boostedGenerationRate()).to.be.equal(
        this.boostedGenerationRate
      );

      await this.veJoeStaking
        .connect(this.dev)
        .setBoostedGenerationRate(ethers.utils.parseEther("3"));

      expect(await this.veJoeStaking.boostedGenerationRate()).to.be.equal(
        ethers.utils.parseEther("3")
      );
    });
  });

  describe("setBoostedThreshold", function () {
    it("should not allow non-owner to setBoostedThreshold", async function () {
      await expect(
        this.veJoeStaking.connect(this.alice).setBoostedThreshold(10)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should not allow owner to setBoostedThreshold to 0", async function () {
      await expect(
        this.veJoeStaking.connect(this.dev).setBoostedThreshold(0)
      ).to.be.revertedWith(
        "VeJoeStaking: expected _boostedThreshold to be > 0 and <= 100"
      );
    });

    it("should not allow owner to setBoostedThreshold greater than 100", async function () {
      await expect(
        this.veJoeStaking.connect(this.dev).setBoostedThreshold(101)
      ).to.be.revertedWith(
        "VeJoeStaking: expected _boostedThreshold to be > 0 and <= 100"
      );
    });

    it("should allow owner to setBoostedThreshold", async function () {
      expect(await this.veJoeStaking.boostedThreshold()).to.be.equal(
        this.boostedThreshold
      );

      await this.veJoeStaking.connect(this.dev).setBoostedThreshold(10);

      expect(await this.veJoeStaking.boostedThreshold()).to.be.equal(10);
    });
  });

  describe("setBoostedDuration", function () {
    it("should not allow non-owner to setBoostedDuration", async function () {
      await expect(
        this.veJoeStaking.connect(this.alice).setBoostedDuration(100)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should not allow owner to setBoostedDuration greater than 365 days", async function () {
      const secondsInHour = 60 * 60;
      const secondsInDay = secondsInHour * 24;
      const secondsInYear = secondsInDay * 365;
      await expect(
        this.veJoeStaking
          .connect(this.dev)
          .setBoostedDuration(secondsInYear + 1)
      ).to.be.revertedWith(
        "VeJoeStaking: expected _boostedDuration to be <= 365 days"
      );
    });

    it("should allow owner to setBoostedThreshold to upper limit", async function () {
      const secondsInHour = 60 * 60;
      const secondsInDay = secondsInHour * 24;
      const secondsInYear = secondsInDay * 365;

      expect(await this.veJoeStaking.boostedDuration()).to.be.equal(
        this.boostedDuration
      );

      await this.veJoeStaking
        .connect(this.dev)
        .setBoostedDuration(secondsInYear);

      expect(await this.veJoeStaking.boostedDuration()).to.be.equal(
        secondsInYear
      );
    });
  });

  describe("deposit", function () {
    it("should not allow deposit 0", async function () {
      await expect(
        this.veJoeStaking.connect(this.alice).deposit(0)
      ).to.be.revertedWith(
        "VeJoeStaking: expected deposit amount to be greater than zero"
      );
    });

    it("should have correct updated user info after first time deposit", async function () {
      const beforeAliceUserInfo = await this.veJoeStaking.userInfos(
        this.alice.address
      );
      // balance
      expect(beforeAliceUserInfo[0]).to.be.equal(0);
      // lastRewardTimestamp
      expect(beforeAliceUserInfo[1]).to.be.equal(0);
      // boostEndTimestamp
      expect(beforeAliceUserInfo[2]).to.be.equal(0);

      // Check joe balance before deposit
      expect(await this.joe.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("1000")
      );

      const depositAmount = ethers.utils.parseEther("100");
      await this.veJoeStaking.connect(this.alice).deposit(depositAmount);
      const depositBlock = await ethers.provider.getBlock();

      // Check joe balance after deposit
      expect(await this.joe.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("900")
      );

      const afterAliceUserInfo = await this.veJoeStaking.userInfos(
        this.alice.address
      );
      // balance
      expect(afterAliceUserInfo[0]).to.be.equal(depositAmount);
      // lastRewardTimestamp
      expect(afterAliceUserInfo[1]).to.be.equal(depositBlock.timestamp);
      // boostEndTimestamp
      expect(afterAliceUserInfo[2]).to.be.equal(
        depositBlock.timestamp + this.boostedDuration
      );
    });

    it("should have correct updated user balance after deposit with non-zero balance", async function () {
      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("5"));

      const afterAliceUserInfo = await this.veJoeStaking.userInfos(
        this.alice.address
      );
      // balance
      expect(afterAliceUserInfo[0]).to.be.equal(ethers.utils.parseEther("105"));
    });

    it("should claim pending veJOE upon depositing with non-zero balance", async function () {
      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      await increase(29);

      // Check veJoe balance before deposit
      expect(await this.veJoe.balanceOf(this.alice.address)).to.be.equal(0);

      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("1"));

      // Check veJoe balance after deposit
      // Should have 100 * 30 * 2 = 6000 veJOE
      expect(await this.veJoe.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("6000")
      );
    });

    it("should receive boosted benefits after depositing boostedThreshold with non-zero balance", async function () {
      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      await increase(this.boostedDuration);

      await this.veJoeStaking.connect(this.alice).claim();

      const afterClaimAliceUserInfo = await this.veJoeStaking.userInfos(
        this.alice.address
      );
      // boostEndTimestamp
      expect(afterClaimAliceUserInfo[2]).to.be.equal(0);

      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("5"));

      const secondDepositBlock = await ethers.provider.getBlock();

      const seconDepositAliceUserInfo = await this.veJoeStaking.userInfos(
        this.alice.address
      );
      // boostEndTimestamp
      expect(seconDepositAliceUserInfo[2]).to.be.equal(
        secondDepositBlock.timestamp + this.boostedDuration
      );
    });

    it("should not receive boosted benefits after depositing less than boostedThreshold with non-zero balance", async function () {
      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      await increase(this.boostedDuration);

      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("1"));

      const afterAliceUserInfo = await this.veJoeStaking.userInfos(
        this.alice.address
      );
      // boostEndTimestamp
      expect(afterAliceUserInfo[2]).to.be.equal(0);
    });

    it("should have boosted period extended after depositing boostedThreshold and currently receiving boosted benefits", async function () {
      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      const initialDepositBlock = await ethers.provider.getBlock();

      const initialDepositAliceUserInfo = await this.veJoeStaking.userInfos(
        this.alice.address
      );
      const initialDepositBoostEndTimestamp = initialDepositAliceUserInfo[2];

      expect(initialDepositBoostEndTimestamp).to.be.equal(
        initialDepositBlock.timestamp + this.boostedDuration
      );

      // Increase by some amount of time less than boostedDuration
      await increase(this.boostedDuration / 2);

      // Deposit boostedThreshold amount so that boost period gets extended
      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("5"));

      const secondDepositBlock = await ethers.provider.getBlock();

      const secondDepositAliceUserInfo = await this.veJoeStaking.userInfos(
        this.alice.address
      );
      // boostEndTimestamp
      const secondDepositBoostEndTimestamp = secondDepositAliceUserInfo[2];

      expect(
        secondDepositBoostEndTimestamp.gt(initialDepositBoostEndTimestamp)
      ).to.be.equal(true);
      expect(secondDepositBoostEndTimestamp).to.be.equal(
        secondDepositBlock.timestamp + this.boostedDuration
      );
    });

    it("should have lastRewardTimestamp updated after depositing if holding max veJOE cap", async function () {
      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      // Increase by `maxCap` seconds to ensure that user will have max veJOE
      // after claiming
      await increase(this.maxCap);

      await this.veJoeStaking.connect(this.alice).claim();

      const claimBlock = await ethers.provider.getBlock();

      const claimAliceUserInfo = await this.veJoeStaking.userInfos(
        this.alice.address
      );
      // lastRewardTimestamp
      expect(claimAliceUserInfo[1]).to.be.equal(claimBlock.timestamp);

      await increase(this.maxCap);

      const pendingVeJoe = await this.veJoeStaking.getPendingVeJoe(
        this.alice.address
      );
      expect(pendingVeJoe).to.be.equal(0);

      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("5"));

      const secondDepositBlock = await ethers.provider.getBlock();

      const secondDepositAliceUserInfo = await this.veJoeStaking.userInfos(
        this.alice.address
      );
      // lastRewardTimestamp
      expect(secondDepositAliceUserInfo[1]).to.be.equal(
        secondDepositBlock.timestamp
      );
    });
  });

  describe("withdraw", function () {
    it("should not allow withdraw 0", async function () {
      await expect(
        this.veJoeStaking.connect(this.alice).withdraw(0)
      ).to.be.revertedWith(
        "VeJoeStaking: expected withdraw amount to be greater than zero"
      );
    });

    it("should not allow withdraw amount greater than user balance", async function () {
      await expect(
        this.veJoeStaking.connect(this.alice).withdraw(1)
      ).to.be.revertedWith(
        "VeJoeStaking: cannot withdraw greater amount of JOE than currently staked"
      );
    });

    it("should have correct updated user info and balances after withdraw", async function () {
      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));
      const depositBlock = await ethers.provider.getBlock();

      expect(await this.joe.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("900")
      );

      await increase(this.boostedDuration / 2);

      await this.veJoeStaking.connect(this.alice).claim();
      const claimBlock = await ethers.provider.getBlock();

      expect(await this.veJoe.balanceOf(this.alice.address)).to.not.be.equal(0);

      const beforeAliceUserInfo = await this.veJoeStaking.userInfos(
        this.alice.address
      );
      // balance
      expect(beforeAliceUserInfo[0]).to.be.equal(
        ethers.utils.parseEther("100")
      );
      // lastRewardTimestamp
      expect(beforeAliceUserInfo[1]).to.be.equal(claimBlock.timestamp);
      // boostEndTimestamp
      expect(beforeAliceUserInfo[2]).to.be.equal(
        depositBlock.timestamp + this.boostedDuration
      );

      await this.veJoeStaking
        .connect(this.alice)
        .withdraw(ethers.utils.parseEther("5"));
      const withdrawBlock = await ethers.provider.getBlock();

      // Check user info fields are updated correctly
      const afterAliceUserInfo = await this.veJoeStaking.userInfos(
        this.alice.address
      );
      // balance
      expect(afterAliceUserInfo[0]).to.be.equal(ethers.utils.parseEther("95"));
      // lastRewardTimestamp
      expect(afterAliceUserInfo[1]).to.be.equal(withdrawBlock.timestamp);
      // boostEndTimestamp
      expect(afterAliceUserInfo[2]).to.be.equal(0);

      // Check user token balances are updated correctly
      expect(await this.veJoe.balanceOf(this.alice.address)).to.be.equal(0);
      expect(await this.joe.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("905")
      );
    });
  });

  describe("claim", function () {
    it("should not be able to claim with zero balance", async function () {
      await expect(
        this.veJoeStaking.connect(this.alice).claim()
      ).to.be.revertedWith(
        "VeJoeStaking: cannot claim veJOE when no JOE is staked"
      );
    });

    it("should update lastRewardTimestamp on claim", async function () {
      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      await increase(100);

      await this.veJoeStaking.connect(this.alice).claim();
      const claimBlock = await ethers.provider.getBlock();

      const afterAliceUserInfo = await this.veJoeStaking.userInfos(
        this.alice.address
      );
      // lastRewardTimestamp
      expect(afterAliceUserInfo[1]).to.be.equal(claimBlock.timestamp);
    });

    it("should reset boostEndTimestamp on claim after boost period ends", async function () {
      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      await increase(this.boostedDuration);

      await this.veJoeStaking.connect(this.alice).claim();

      const afterAliceUserInfo = await this.veJoeStaking.userInfos(
        this.alice.address
      );
      // boostEndTimestamp
      expect(afterAliceUserInfo[2]).to.be.equal(0);
    });

    it("should receive veJOE on claim", async function () {
      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      await increase(this.boostedDuration - 1);

      // Check veJoe balance before claim
      expect(await this.veJoe.balanceOf(this.alice.address)).to.be.equal(0);

      await this.veJoeStaking.connect(this.alice).claim();

      // Check veJoe balance after claim
      expect(await this.veJoe.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("10000")
      );
    });

    it("should receive correct veJOE amount on claim when lastRewardTimestamp < boostEndTimestamp < now", async function () {
      await this.veJoeStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      // Increase by some duration before boost period ends
      await increase(this.boostedDuration / 2 - 1);

      // Ensure user has 0 veJoe balance before first claim
      expect(await this.veJoe.balanceOf(this.alice.address)).to.be.equal(0);

      // Perform first claim before boost period ends
      await this.veJoeStaking.connect(this.alice).claim();

      // Ensure user has 100 * 25 * 2 = 5000 veJOE
      expect(await this.veJoe.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("5000")
      );

      // Increase by some duration after boost period ends
      await increase(this.boostedDuration - 1);

      // Perform claim after boost period ended
      await this.veJoeStaking.connect(this.alice).claim();

      // Ensure user has 5000 + 100 * 25 * 2 + 100 * 25 * 1 = 12500 veJoe
      expect(await this.veJoe.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("12500")
      );
    });
  });

  after(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
  });
});

const increase = (seconds) => {
  ethers.provider.send("evm_increaseTime", [seconds]);
  ethers.provider.send("evm_mine", []);
};
