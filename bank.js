
function depositToBank(amount){
  if(amount > 0 && state.cash >= amount){
    state.cash -= amount;
    state.bank.deposit += amount;
  }
}

function withdrawFromBank(amount){
  if(amount > 0 && state.bank.deposit >= amount){
    state.bank.deposit -= amount;
    state.cash += amount;
  }
}

function takeLoan(amount, rate = 0.05){
  if(amount > 0){
    const loan = {
      id: 'loan_' + state.bank.nextLoanId++,
      originalAmount: amount,
      remaining: amount,
      interestRate: rate,
      daysActive: 0
    };
    state.cash += amount;
    state.bank.loans.push(loan);
  }
}

function repayLoan(id, amount){
  const loan = state.bank.loans.find(l => l.id === id);
  if(loan && amount > 0 && state.cash >= amount){
    loan.remaining -= amount;
    state.cash -= amount;
    if(loan.remaining <= 0){
      state.bank.loans = state.bank.loans.filter(l => l.id !== id);
    }
  }
}
